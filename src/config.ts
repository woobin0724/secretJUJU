import type { FlowMode, QuestionId } from './types';

/** 섬(생각하는 시간) 길이(초). 건너뛸 수 없다. */
export const ISLAND_SECONDS = 10;
/** 섬의 마지막 감사 문구가 나타나는 시점(남은 초). */
export const ISLAND_THANKS_AT = 1;
/** 카운트가 0이 된 뒤 감사 문구를 읽을 수 있도록 더 머무는 시간(ms). */
export const ISLAND_HOLD_MS = 2500;

/** 어느 문항 뒤에 섬을 넣을지. 발표 모드는 Q4 뒤에만, 혼자 해보기는 매 문항 뒤에. */
export const ISLAND_AFTER: Record<FlowMode, QuestionId[]> = {
  live: ['q4'],
  solo: ['q1', 'q2', 'q3', 'q4'],
};

/** 계급 판정 슬롯이 도는 시간(ms). */
export const CASTE_SPIN_MS = 3000;
/** 입국 승인 도장을 보여 주는 시간(ms). 도장 애니메이션 자체는 0.4초. */
export const STAMP_HOLD_MS = 2200;
/** 화면 전환 페이드(ms). styles.css 의 --fade 와 맞춘다. */
export const FADE_MS = 600;
/** 발표 화면 숫자가 변하는 시간(ms). */
export const NUMBER_TWEEN_MS = 500;

/** 데모 모드 가짜 청중 설정. */
export const DEMO = {
  crowdSize: 48,
  tickMinMs: 1000,
  tickMaxMs: 2000,
  /** '예 / 누른다' 목표 비율 */
  targets: { q1: 0.79, q2: 0.67, q3: 0.46, q4: 0.62 } as Record<QuestionId, number>,
  round2Q4: 0.41,
  seed: 1932,
};

/** 계급 색(원작 설정). */
export const CASTES = [
  { key: 'alpha', color: '#8E8E8E' },
  { key: 'beta', color: '#B48FD9' },
  { key: 'gamma', color: '#4FA36B' },
  { key: 'delta', color: '#B5A27A' },
  { key: 'epsilon', color: '#1A1A1A' },
] as const;

/** 장면별 배경 미디어(public/media 안의 파일 이름, 확장자 제외). */
export const SCENES = {
  city: 'city-castes',
  arrival: 'scene-1-arrival',
  sorting: 'scene-2-sorting',
  hatchery: 'scene-3-hatchery',
  island: 'scene-4-island',
  exit: 'scene-5-exit',
} as const;
export type SceneKey = keyof typeof SCENES;

/** 장면별 소리(public/media 의 같은 이름 .mp3). 기본은 꺼짐이고 청중 화면에서만 쓴다. */
export const SOUND = {
  volume: 0.6,
  fadeMs: 500,
  /** 반복하지 않고 한 번만 재생하는 장면 */
  once: ['exit'] as SceneKey[],
  storageKey: 'bnw:sound',
};

export function soundLoops(scene: SceneKey): boolean {
  return !SOUND.once.includes(scene);
}
