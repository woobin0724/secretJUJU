import { PHASES, type Phase } from '../types';

export function isPhase(v: unknown): v is Phase {
  return typeof v === 'string' && (PHASES as readonly string[]).includes(v);
}

export function nextPhase(p: Phase): Phase | null {
  const i = PHASES.indexOf(p);
  return i < PHASES.length - 1 ? PHASES[i + 1] : null;
}

export function prevPhase(p: Phase): Phase | null {
  const i = PHASES.indexOf(p);
  return i > 0 ? PHASES[i - 1] : null;
}

/** 해당 라운드에 응답을 쓸 수 있는 단계인가(보안 규칙과 같은 조건). */
export function isRoundOpen(round: 1 | 2, p: Phase): boolean {
  return round === 1 ? p === 'round1' : p === 'round2';
}
