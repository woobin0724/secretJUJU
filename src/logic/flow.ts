import { QUESTION_IDS, type Answers, type Phase, type QuestionId } from '../types';

export type Step =
  | { kind: 'waiting' }
  | { kind: 'arrival' }
  | { kind: 'question'; q: QuestionId; index: number }
  | { kind: 'island'; q: QuestionId; answer: boolean }
  | { kind: 'caste' }
  | { kind: 'stamp' }
  | { kind: 'lobby'; closed: boolean }
  | { kind: 'recheck' }
  | { kind: 'exit' };

/** 서버에 저장하지 않는, 이 기기만의 진행 상태. */
export interface Progress {
  started: boolean;
  islandsDone: QuestionId[];
  casteDone: boolean;
  stampDone: boolean;
}

export const EMPTY_PROGRESS: Progress = { started: false, islandsDone: [], casteDone: false, stampDone: false };

export function hasAnyAnswer(a: Answers): boolean {
  return QUESTION_IDS.some((q) => typeof a[q] === 'boolean');
}

/** 섬에서 보여 줄 질문을 고른다. */
export function pickIslandQuestion<T>(table: Record<QuestionId, { yes: T; no: T }>, q: QuestionId, answer: boolean): T {
  return answer ? table[q].yes : table[q].no;
}

/**
 * 진행자 단계 + 내 응답 + 기기 진행 상태로 지금 보여 줄 화면을 정한다.
 * 이미 답한 문항은 다시 나오지 않으므로 새로고침해도 이어서 진행된다.
 */
export function deriveStep(
  phase: Phase,
  mine: { round1: Answers; round2: Answers },
  progress: Progress,
  islandAfter: readonly QuestionId[],
): Step {
  switch (phase) {
    case 'waiting':
      return { kind: 'waiting' };
    case 'round1': {
      if (!progress.started && !hasAnyAnswer(mine.round1)) return { kind: 'arrival' };
      for (let i = 0; i < QUESTION_IDS.length; i++) {
        const q = QUESTION_IDS[i];
        const a = mine.round1[q];
        if (typeof a !== 'boolean') return { kind: 'question', q, index: i };
        if (islandAfter.includes(q) && !progress.islandsDone.includes(q)) return { kind: 'island', q, answer: a };
      }
      if (!progress.casteDone) return { kind: 'caste' };
      if (!progress.stampDone) return { kind: 'stamp' };
      return { kind: 'lobby', closed: false };
    }
    case 'closed1':
      return { kind: 'lobby', closed: true };
    case 'round2':
      return typeof mine.round2.q4 === 'boolean' ? { kind: 'exit' } : { kind: 'recheck' };
    case 'ended':
      return { kind: 'exit' };
  }
}

/** 화면이 바뀌었는지 판단하는 키. */
export function stepKey(s: Step): string {
  return s.kind === 'question' || s.kind === 'island' ? `${s.kind}:${s.q}` : s.kind === 'lobby' ? `lobby:${s.closed}` : s.kind;
}
