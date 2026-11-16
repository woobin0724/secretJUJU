export const PHASES = ['waiting', 'round1', 'closed1', 'round2', 'ended'] as const;
export type Phase = (typeof PHASES)[number];

export const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4'] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];

/** 문항별 부분 저장이 가능하다. true = 예 / 누른다 */
export type Answers = Partial<Record<QuestionId, boolean>>;
export type ResponseMap = Record<string, Answers>;

export type FlowMode = 'live' | 'solo';
