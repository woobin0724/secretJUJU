import { QUESTION_IDS, type Answers, type Phase, type QuestionId } from '../types';

/** 재현 가능한 난수(mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Bot {
  uid: string;
  round1: Record<QuestionId, boolean>;
  round2q4: boolean;
}

function shuffledFlags(n: number, ratio: number, rng: () => number): boolean[] {
  const yes = Math.round(n * ratio);
  const arr = Array.from({ length: n }, (_, i) => i < yes);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 가짜 청중의 답을 미리 정한다. 전원이 답하면 정확히 목표 비율(반올림)이 된다. */
export function planCrowd(n: number, targets: Record<QuestionId, number>, round2Q4: number, seed: number): Bot[] {
  const rng = makeRng(seed);
  const cols = Object.fromEntries(QUESTION_IDS.map((q) => [q, shuffledFlags(n, targets[q], rng)])) as Record<QuestionId, boolean[]>;
  const r2 = shuffledFlags(n, round2Q4, rng);
  return Array.from({ length: n }, (_, i) => ({
    uid: `bot-${String(i + 1).padStart(2, '0')}`,
    round1: { q1: cols.q1[i], q2: cols.q2[i], q3: cols.q3[i], q4: cols.q4[i] },
    round2q4: r2[i],
  }));
}

export type CrowdEvent =
  | { type: 'join'; uid: string }
  | { type: 'answer'; round: 1 | 2; uid: string; q: QuestionId; value: boolean };

export interface CrowdView {
  phase: Phase;
  presence: Record<string, true>;
  round1: Record<string, Answers>;
  round2: Record<string, Answers>;
}

/**
 * 한 번의 틱(1~2초 간격)에 일어날 일을 계산한다. 순수 함수.
 * - waiting/round1: 한 명씩 입장한다.
 * - round1: 입장한 사람이 다음 문항을 하나씩 답한다.
 * - round2: 몇 명씩 재심사에 답한다.
 */
export function crowdTick(bots: Bot[], view: CrowdView, rng: () => number): CrowdEvent[] {
  const events: CrowdEvent[] = [];
  const joined = (b: Bot) => view.presence[b.uid] === true;
  if (view.phase === 'waiting' || view.phase === 'round1') {
    const next = bots.find((b) => !joined(b));
    if (next) events.push({ type: 'join', uid: next.uid });
  }
  if (view.phase === 'round1') {
    for (const b of bots) {
      if (!joined(b)) continue;
      const q = QUESTION_IDS.find((id) => typeof view.round1[b.uid]?.[id] !== 'boolean');
      if (q && rng() < 0.4) events.push({ type: 'answer', round: 1, uid: b.uid, q, value: b.round1[q] });
    }
  }
  if (view.phase === 'round2') {
    const waiting = bots.filter((b) => typeof view.round2[b.uid]?.q4 !== 'boolean');
    const count = Math.min(waiting.length, 2 + Math.floor(rng() * 3));
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rng() * waiting.length);
      const [b] = waiting.splice(idx, 1);
      events.push({ type: 'answer', round: 2, uid: b.uid, q: 'q4', value: b.round2q4 });
    }
  }
  return events;
}

/** 라운드를 닫을 때 아직 답하지 않은 가짜 청중의 답을 한꺼번에 채운다(결과 화면이 목표 비율을 보이도록). */
export function crowdFlush(bots: Bot[], view: CrowdView, round: 1 | 2): CrowdEvent[] {
  const events: CrowdEvent[] = [];
  for (const b of bots) {
    if (view.presence[b.uid] !== true) events.push({ type: 'join', uid: b.uid });
    if (round === 1) {
      for (const q of QUESTION_IDS) {
        if (typeof view.round1[b.uid]?.[q] !== 'boolean') events.push({ type: 'answer', round: 1, uid: b.uid, q, value: b.round1[q] });
      }
    } else if (typeof view.round2[b.uid]?.q4 !== 'boolean') {
      events.push({ type: 'answer', round: 2, uid: b.uid, q: 'q4', value: b.round2q4 });
    }
  }
  return events;
}
