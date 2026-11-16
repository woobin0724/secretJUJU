import { QUESTION_IDS, type Phase, type QuestionId, type ResponseMap } from '../types';

export interface Tally {
  yes: number;
  total: number;
  /** 0~100 정수. 응답이 없으면 null (0으로 나누지 않는다). */
  pct: number | null;
}

export function tally(responses: ResponseMap | null | undefined, q: QuestionId): Tally {
  let yes = 0;
  let total = 0;
  for (const answers of Object.values(responses ?? {})) {
    const v = answers?.[q];
    if (typeof v !== 'boolean') continue;
    total += 1;
    if (v) yes += 1;
  }
  return { yes, total, pct: total === 0 ? null : Math.round((yes / total) * 100) };
}

export function tallyAll(responses: ResponseMap | null | undefined): Record<QuestionId, Tally> {
  return Object.fromEntries(QUESTION_IDS.map((q) => [q, tally(responses, q)])) as Record<QuestionId, Tally>;
}

/** 한 문항이라도 답한 사람 수. */
export function respondentCount(responses: ResponseMap | null | undefined): number {
  let n = 0;
  for (const answers of Object.values(responses ?? {})) {
    if (QUESTION_IDS.some((q) => typeof answers?.[q] === 'boolean')) n += 1;
  }
  return n;
}

export interface RoundComparison {
  before: Tally;
  after: Tally;
  /** 지금 - 처음 (퍼센트포인트). 한쪽이라도 비어 있으면 null. */
  delta: number | null;
}

export function compareRounds(round1: ResponseMap | null | undefined, round2: ResponseMap | null | undefined): RoundComparison {
  const before = tally(round1, 'q4');
  const after = tally(round2, 'q4');
  return { before, after, delta: before.pct === null || after.pct === null ? null : after.pct - before.pct };
}

/** 발표 화면 상단 '응답 n명'에 쓸 숫자: 재심사 이후에는 2라운드, 그 전에는 1라운드. */
export function respondentsForPhase(phase: Phase, round1: ResponseMap, round2: ResponseMap): number {
  return respondentCount(phase === 'round2' || phase === 'ended' ? round2 : round1);
}
