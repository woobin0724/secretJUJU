import { SCENES, SOUND, soundLoops, type SceneKey } from './config';
import { mediaUrl } from './mode';

/**
 * 장면 소리 엔진(Web Audio).
 * - <audio>.volume 은 아이폰 사파리에서 무시되므로 GainNode 로 음량과 페이드를 건다.
 * - AudioContext 는 버튼을 누른 그 순간(사용자 동작 안)에 만들고 깨워야 아이폰·안드로이드에서 소리가 난다.
 * - 파일이 없거나 디코딩·재생에 실패하면 아무 일도 일어나지 않는다(에러를 던지지 않는다).
 */

type Ctor = typeof AudioContext;
const AudioCtor: Ctor | undefined =
  typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext);

const files = new Set<string>(typeof __MEDIA_FILES__ === 'undefined' ? [] : __MEDIA_FILES__);
const hasFile = (scene: SceneKey) => files.has(`${SCENES[scene]}.mp3`);

/** 소리 버튼을 보여 줄지: Web Audio 가 있고 mp3 가 하나라도 있을 때만. */
export const soundAvailable = Boolean(AudioCtor) && (Object.keys(SCENES) as SceneKey[]).some(hasFile);

interface Track {
  scene: SceneKey;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
let wanted: SceneKey | null = null;
let current: Track | null = null;
let ticket = 0;
const buffers = new Map<SceneKey, Promise<AudioBuffer | null>>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
const fade = () => SOUND.fadeMs / 1000;

export function subscribeSound(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** 지금 나오고 있는 장면 소리(없으면 null). 화면 표시와 테스트용. */
export function currentTrack(): SceneKey | null {
  return enabled ? (current?.scene ?? null) : null;
}

function ensureContext(): AudioContext | null {
  if (ctx || !AudioCtor) return ctx;
  try {
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = SOUND.volume;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function load(scene: SceneKey): Promise<AudioBuffer | null> {
  let p = buffers.get(scene);
  if (!p) {
    p = (async () => {
      if (!ctx || !hasFile(scene)) return null;
      try {
        const res = await fetch(mediaUrl(`${SCENES[scene]}.mp3`));
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        const c = ctx;
        // 예전 사파리는 콜백 형태만 지원한다.
        return await new Promise<AudioBuffer | null>((resolve) => {
          const maybe = c.decodeAudioData(data, resolve, () => resolve(null));
          if (maybe && typeof maybe.catch === 'function') maybe.catch(() => resolve(null));
        });
      } catch {
        return null;
      }
    })();
    buffers.set(scene, p);
  }
  return p;
}

function fadeOut(track: Track) {
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    track.gain.gain.linearRampToValueAtTime(0, now + fade());
    track.source.stop(now + fade() + 0.05);
  } catch {
    /* 이미 멈춘 소리 */
  }
}

async function sync() {
  if (!ctx || !master || !enabled) return;
  const scene = wanted;
  if (current?.scene === scene) return;
  const mine = ++ticket;
  if (current) {
    fadeOut(current);
    current = null;
    notify();
  }
  if (!scene) return;
  const buffer = await load(scene);
  if (!buffer || mine !== ticket || !enabled || !ctx || !master) return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = soundLoops(scene);
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade());
    source.connect(gain).connect(master);
    source.start();
    const track: Track = { scene, source, gain };
    source.onended = () => {
      try {
        gain.disconnect();
      } catch {
        /* 이미 끊긴 노드 */
      }
    };
    current = track;
    notify();
  } catch {
    /* 재생 실패는 조용히 넘어간다 */
  }
}

/** 장면이 바뀔 때 부른다. 꺼져 있으면 기억만 해 둔다. */
export function setSoundScene(scene: SceneKey | null) {
  wanted = scene;
  void sync();
}

async function wake(timeoutMs: number): Promise<boolean> {
  const c = ensureContext();
  if (!c) return false;
  try {
    // 자동재생이 막혀 있으면 resume() 이 끝나지 않으므로 기다리는 시간을 정해 둔다.
    await Promise.race([c.resume(), new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch {
    return false;
  }
  return c.state === 'running';
}

/**
 * 소리를 켠다. 반드시 클릭/터치 핸들러 안에서 바로 불러야 한다(아이폰 사파리).
 * 돌려주는 값은 실제로 소리를 낼 수 있게 됐는지.
 */
export async function enableSound(timeoutMs = 1500): Promise<boolean> {
  const c = ensureContext();
  if (c) {
    try {
      // 아이폰 잠금 해제: 사용자 동작 안에서 무음 버퍼를 한 번 재생한다.
      const silent = c.createBufferSource();
      silent.buffer = c.createBuffer(1, 1, 22050);
      silent.connect(c.destination);
      silent.start(0);
    } catch {
      /* 무시 */
    }
  }
  const ok = await wake(timeoutMs);
  if (!ok) return false;
  enabled = true;
  await sync();
  notify();
  return true;
}

/** 새로고침 뒤 저장된 '켬' 상태를 되살려 본다. 브라우저가 자동재생을 막으면 false. */
export function restoreSound(): Promise<boolean> {
  return enableSound(400);
}

export function disableSound() {
  enabled = false;
  ticket++;
  if (current) {
    fadeOut(current);
    current = null;
  }
  const c = ctx;
  if (c) {
    setTimeout(() => {
      if (!enabled) void c.suspend().catch(() => undefined);
    }, SOUND.fadeMs + 100);
  }
  notify();
}

// 탭이 백그라운드로 가면 일시정지, 돌아오면 이어서 재생.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => undefined);
    else if (enabled) void ctx.resume().catch(() => undefined);
  });
}

export function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND.storageKey) === '1';
  } catch {
    return false;
  }
}

export function writeSoundPref(on: boolean) {
  try {
    localStorage.setItem(SOUND.storageKey, on ? '1' : '0');
  } catch {
    /* 저장하지 못해도 이번 화면에서는 동작한다 */
  }
}

// 상태 확인용(테스트·디버깅). 소리를 바꾸지는 않는다.
if (typeof window !== 'undefined') {
  const w = window as unknown as { __bnwAudioState?: () => string; __bnwAudioLoop?: () => boolean | null };
  w.__bnwAudioState = () => ctx?.state ?? 'none';
  w.__bnwAudioLoop = () => current?.source.loop ?? null;
}
