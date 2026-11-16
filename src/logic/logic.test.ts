import { describe, expect, it } from 'vitest';
import { DEMO, ISLAND_AFTER } from '../config';
import { TEXT } from '../content';
import { audienceUrl, urlParams } from '../mode';
import type { Answers, Phase, ResponseMap } from '../types';
import { compareRounds, respondentCount, respondentsForPhase, tally, tallyAll } from './aggregate';
import { crowdFlush, crowdTick, makeRng, planCrowd, type CrowdView } from './demoCrowd';
import { deriveStep, EMPTY_PROGRESS, pickIslandQuestion, stepKey, type Progress } from './flow';
import { isPhase, isRoundOpen, nextPhase, prevPhase } from './phase';

describe('집계', () => {
  it('응답이 0건이면 0으로 나누지 않고 null 을 돌려준다', () => {
    expect(tally({}, 'q4')).toEqual({ yes: 0, total: 0, pct: null });
    expect(tally(null, 'q1')).toEqual({ yes: 0, total: 0, pct: null });
    expect(respondentCount(undefined)).toBe(0);
    expect(compareRounds({}, {}).delta).toBeNull();
  });

  it('일부만 답한 응답은 답한 문항만 센다', () => {
    const r: ResponseMap = { a: { q1: true, q2: false }, b: { q1: false }, c: {}, d: { q1: true, q4: true } };
    expect(tally(r, 'q1')).toEqual({ yes: 2, total: 3, pct: 67 });
    expect(tally(r, 'q2')).toEqual({ yes: 0, total: 1, pct: 0 });
    expect(tally(r, 'q3').pct).toBeNull();
    expect(tallyAll(r).q4).toEqual({ yes: 1, total: 1, pct: 100 });
    expect(respondentCount(r)).toBe(3);
  });

  it('라운드 비교: 처음과 지금의 Q4 비율과 차이', () => {
    const r1: ResponseMap = { a: { q4: true }, b: { q4: true }, c: { q4: false }, d: { q1: true } };
    const r2: ResponseMap = { a: { q4: false }, b: { q4: true }, c: { q4: false }, e: { q4: false } };
    const cmp = compareRounds(r1, r2);
    expect(cmp.before.pct).toBe(67);
    expect(cmp.after.pct).toBe(25);
    expect(cmp.delta).toBe(-42);
    expect(compareRounds(r1, {}).delta).toBeNull();
    expect(respondentsForPhase('round1', r1, r2)).toBe(4);
    expect(respondentsForPhase('ended', r1, r2)).toBe(4);
    expect(respondentsForPhase('round2', r1, {})).toBe(0);
  });
});

describe('단계 전환', () => {
  it('waiting → round1 → closed1 → round2 → ended 순서로만 움직인다', () => {
    const seq: Phase[] = ['waiting'];
    let p: Phase | null = 'waiting';
    while ((p = nextPhase(p))) seq.push(p);
    expect(seq).toEqual(['waiting', 'round1', 'closed1', 'round2', 'ended']);
    expect(nextPhase('ended')).toBeNull();
    expect(prevPhase('waiting')).toBeNull();
    expect(prevPhase('round2')).toBe('closed1');
  });

  it('라운드는 해당 단계에서만 열려 있다', () => {
    expect(isRoundOpen(1, 'round1')).toBe(true);
    expect(isRoundOpen(1, 'closed1')).toBe(false);
    expect(isRoundOpen(2, 'round2')).toBe(true);
    expect(isRoundOpen(2, 'ended')).toBe(false);
    expect(isPhase('round1')).toBe(true);
    expect(isPhase('round3')).toBe(false);
  });
});

describe('청중 흐름', () => {
  const none = { round1: {}, round2: {} };
  const step = (phase: Phase, r1: Answers, p: Partial<Progress> = {}, mode: 'live' | 'solo' = 'live', r2: Answers = {}) =>
    stepKey(deriveStep(phase, { round1: r1, round2: r2 }, { ...EMPTY_PROGRESS, ...p }, ISLAND_AFTER[mode]));

  it('발표 모드: 입국장 → Q1~Q4 → 섬 → 계급 → 도장 → 대기', () => {
    expect(stepKey(deriveStep('waiting', none, EMPTY_PROGRESS, ISLAND_AFTER.live))).toBe('waiting');
    expect(step('round1', {})).toBe('arrival');
    expect(step('round1', {}, { started: true })).toBe('question:q1');
    expect(step('round1', { q1: true })).toBe('question:q2');
    expect(step('round1', { q1: true, q2: false, q3: true })).toBe('question:q4');
    const all = { q1: true, q2: false, q3: true, q4: false };
    expect(step('round1', all)).toBe('island:q4');
    expect(step('round1', all, { islandsDone: ['q4'] })).toBe('caste');
    expect(step('round1', all, { islandsDone: ['q4'], casteDone: true })).toBe('stamp');
    expect(step('round1', all, { islandsDone: ['q4'], casteDone: true, stampDone: true })).toBe('lobby:false');
  });

  it('새로고침해도 이미 답한 문항은 다시 나오지 않는다', () => {
    expect(step('round1', { q1: true, q2: true })).toBe('question:q3');
  });

  it('혼자 해보기: 매 문항 뒤에 섬이 나온다', () => {
    expect(step('round1', { q1: false }, {}, 'solo')).toBe('island:q1');
    expect(step('round1', { q1: false }, { islandsDone: ['q1'] }, 'solo')).toBe('question:q2');
    expect(step('round1', { q1: false, q2: true }, { islandsDone: ['q1'] }, 'solo')).toBe('island:q2');
  });

  it('마감되면 남은 문항을 건너뛰고, 재심사는 1라운드 미참여자도 받는다', () => {
    expect(step('closed1', { q1: true })).toBe('lobby:true');
    expect(step('round2', {})).toBe('recheck');
    expect(step('round2', {}, {}, 'live', { q4: true })).toBe('exit');
    expect(step('ended', { q1: true })).toBe('exit');
  });

  it('섬 질문은 문항과 답에 따라 고른다', () => {
    const t = TEXT.island.questions;
    expect(pickIslandQuestion(t, 'q1', true)).toBe('슬픔이 없으면, 기쁨이 기쁨인 줄 알 수 있습니까?');
    expect(pickIslandQuestion(t, 'q3', false)).toBe('남들과 다른 생각을 마지막으로 말해 본 건 언제입니까?');
    expect(pickIslandQuestion(t, 'q4', true)).toContain('함께 지워집니다');
    expect(pickIslandQuestion(t, 'q4', false)).toContain('불행해질 권리');
  });
});

describe('데모 가짜 청중', () => {
  const bots = planCrowd(DEMO.crowdSize, DEMO.targets, DEMO.round2Q4, DEMO.seed);

  function simulate(phase: Phase, view: CrowdView, ticks: number, seed: number) {
    const rng = makeRng(seed);
    view.phase = phase;
    for (let i = 0; i < ticks; i++) {
      for (const e of crowdTick(bots, view, rng)) {
        if (e.type === 'join') view.presence[e.uid] = true;
        else {
          const map = e.round === 1 ? view.round1 : view.round2;
          map[e.uid] = { ...map[e.uid], [e.q]: e.value };
        }
      }
    }
    return view;
  }

  it('48명이고 같은 시드면 같은 계획이 나온다', () => {
    expect(bots).toHaveLength(48);
    expect(planCrowd(DEMO.crowdSize, DEMO.targets, DEMO.round2Q4, DEMO.seed)).toEqual(bots);
  });

  it('틱이 쌓이면 1라운드 Q4 는 약 62%, 재심사는 약 41% 로 수렴한다', () => {
    const view: CrowdView = { phase: 'waiting', presence: {}, round1: {}, round2: {} };
    simulate('waiting', view, 5, 1);
    expect(Object.keys(view.presence)).toHaveLength(5);
    expect(tally(view.round1, 'q4').total).toBe(0);

    simulate('round1', view, 20, 2);
    const mid = tally(view.round1, 'q1').total;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(48); // 서서히 쌓인다

    simulate('round1', view, 400, 3);
    const q4 = tally(view.round1, 'q4');
    expect(q4.total).toBe(48);
    expect(Math.abs(q4.pct! - 62)).toBeLessThanOrEqual(1);
    for (const q of ['q1', 'q2', 'q3'] as const) {
      expect(Math.abs(tally(view.round1, q).pct! - DEMO.targets[q] * 100)).toBeLessThanOrEqual(2);
    }

    simulate('closed1', view, 10, 4);
    expect(tally(view.round2, 'q4').total).toBe(0);

    simulate('round2', view, 3, 5);
    const part = tally(view.round2, 'q4').total;
    expect(part).toBeGreaterThan(0);
    expect(part).toBeLessThan(48);
    simulate('round2', view, 60, 6);
    const again = tally(view.round2, 'q4');
    expect(again.total).toBe(48);
    expect(Math.abs(again.pct! - 41)).toBeLessThanOrEqual(1);
  });

  it('라운드를 닫으면 남은 응답이 한꺼번에 채워진다', () => {
    const view: CrowdView = { phase: 'round1', presence: {}, round1: { 'bot-01': { q1: bots[0].round1.q1 } }, round2: {} };
    const events = crowdFlush(bots, view, 1);
    expect(events.filter((e) => e.type === 'join')).toHaveLength(48);
    expect(events.filter((e) => e.type === 'answer')).toHaveLength(48 * 4 - 1);
    expect(crowdFlush(bots, view, 2).filter((e) => e.type === 'answer')).toHaveLength(48);
  });
});

describe('주소 처리', () => {
  it('해시 안의 쿼리와 일반 쿼리를 모두 읽는다', () => {
    expect(urlParams({ search: '', hash: '#/screen?demo=1' }).get('demo')).toBe('1');
    expect(urlParams({ search: '?demo=1', hash: '#/' }).get('demo')).toBe('1');
    expect(urlParams({ search: '', hash: '#/' }).get('demo')).toBeNull();
  });

  it('QR 주소는 쿼리를 뺀 청중 경로이고 ?qr= 로 덮어쓸 수 있다', () => {
    const base = { origin: 'https://woobin0724.github.io', pathname: '/secretJUJU/' };
    expect(audienceUrl({ ...base, search: '', hash: '#/screen?demo=1' })).toBe('https://woobin0724.github.io/secretJUJU/#/');
    expect(audienceUrl({ ...base, search: '', hash: '#/screen?qr=https%3A%2F%2Fex.kr%2Fa' })).toBe('https://ex.kr/a');
  });
});
