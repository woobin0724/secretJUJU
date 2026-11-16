import type { Answers, Phase, QuestionId, ResponseMap } from '../types';

export type Role = 'audience' | 'screen' | 'admin';

export interface Snapshot {
  /** 첫 데이터를 받아 화면을 그릴 수 있는 상태인가 */
  ready: boolean;
  phase: Phase;
  uid: string | null;
  mine: { round1: Answers; round2: Answers };
  /** 집계용 전체 응답(screen/admin 만 채워진다) */
  all: { round1: ResponseMap; round2: ResponseMap };
  presence: number;
  connected: boolean;
  user: { email: string | null; isAdmin: boolean } | null;
  error: 'auth' | 'data' | null;
}

export const EMPTY_SNAPSHOT: Snapshot = {
  ready: false,
  phase: 'waiting',
  uid: null,
  mine: { round1: {}, round2: {} },
  all: { round1: {}, round2: {} },
  presence: 0,
  connected: true,
  user: null,
  error: null,
};

export interface Store {
  kind: 'demo' | 'firebase';
  getSnapshot(): Snapshot;
  subscribe(listener: () => void): () => void;
  answer(round: 1 | 2, q: QuestionId, value: boolean): void;
  setPhase(phase: Phase): Promise<void>;
  reset(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  dispose(): void;
}
