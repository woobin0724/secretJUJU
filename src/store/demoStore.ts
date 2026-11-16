import { DEMO } from '../config';
import { crowdFlush, crowdTick, planCrowd, type CrowdEvent } from '../logic/demoCrowd';
import { isPhase, isRoundOpen } from '../logic/phase';
import type { Answers, Phase, QuestionId, ResponseMap } from '../types';
import { EMPTY_SNAPSHOT, type Role, type Snapshot, type Store } from './types';

interface DemoState {
  phase: Phase;
  updatedAt: number;
  round1: ResponseMap;
  round2: ResponseMap;
  presence: Record<string, true>;
}

type Msg =
  | { type: 'hello' }
  | { type: 'sync'; state: DemoState }
  | { type: 'phase'; phase: Phase; at: number }
  | { type: 'reset'; at: number }
  | { type: 'leave'; uid: string }
  | { type: 'events'; events: CrowdEvent[] };

const CHANNEL = 'bnw-demo';

function freshState(): DemoState {
  return { phase: 'waiting', updatedAt: 0, round1: {}, round2: {}, presence: {} };
}

function demoUid(): string {
  try {
    const saved = sessionStorage.getItem('bnw:demo-uid');
    if (saved) return saved;
    const uid = `tab-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('bnw:demo-uid', uid);
    return uid;
  } catch {
    return `tab-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Firebase 없이 메모리에서 도는 저장소. 같은 브라우저의 탭끼리 BroadcastChannel 로 동기화한다.
 * 가짜 청중은 탭 하나(Web Locks 로 뽑은 리더)만 움직인다.
 */
export function createDemoStore(role: Role): Store {
  const uid = demoUid();
  const bots = planCrowd(DEMO.crowdSize, DEMO.targets, DEMO.round2Q4, DEMO.seed);
  let state = freshState();
  let snap: Snapshot = EMPTY_SNAPSHOT;
  const listeners = new Set<() => void>();
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const emit = () => {
    snap = {
      ready: true,
      phase: state.phase,
      uid,
      mine: { round1: state.round1[uid] ?? {}, round2: state.round2[uid] ?? {} },
      all: { round1: state.round1, round2: state.round2 },
      presence: Object.keys(state.presence).length,
      connected: true,
      user: { email: 'demo', isAdmin: true },
      error: null,
    };
    listeners.forEach((l) => l());
  };

  const send = (msg: Msg) => channel?.postMessage(msg);

  const applyEvents = (events: CrowdEvent[]) => {
    if (events.length === 0) return;
    const next: DemoState = { ...state, round1: { ...state.round1 }, round2: { ...state.round2 }, presence: { ...state.presence } };
    for (const e of events) {
      if (e.type === 'join') {
        next.presence[e.uid] = true;
      } else {
        const map = e.round === 1 ? next.round1 : next.round2;
        const cur: Answers = map[e.uid] ?? {};
        if (typeof cur[e.q] === 'boolean') continue; // 한 번만 쓸 수 있다
        map[e.uid] = { ...cur, [e.q]: e.value };
      }
    }
    state = next;
  };

  const joinSelf = () => {
    if (role !== 'audience') return;
    const events: CrowdEvent[] = [{ type: 'join', uid }];
    applyEvents(events);
    send({ type: 'events', events });
  };

  const dispatch = (events: CrowdEvent[]) => {
    if (events.length === 0) return;
    applyEvents(events);
    send({ type: 'events', events });
    emit();
  };

  const merge = (other: DemoState) => {
    const next = freshState();
    const newer = other.updatedAt > state.updatedAt ? other : state;
    next.phase = newer.phase;
    next.updatedAt = newer.updatedAt;
    next.presence = { ...other.presence, ...state.presence };
    for (const key of ['round1', 'round2'] as const) {
      const merged: ResponseMap = { ...other[key] };
      for (const [id, a] of Object.entries(state[key])) merged[id] = { ...merged[id], ...a };
      next[key] = merged;
    }
    state = next;
  };

  if (channel) {
    channel.onmessage = (ev: MessageEvent<Msg>) => {
      if (disposed) return;
      const msg = ev.data;
      switch (msg.type) {
        case 'hello':
          send({ type: 'sync', state });
          return;
        case 'sync':
          merge(msg.state);
          break;
        case 'phase':
          if (isPhase(msg.phase) && msg.at >= state.updatedAt) state = { ...state, phase: msg.phase, updatedAt: msg.at };
          break;
        case 'reset':
          state = { ...freshState(), updatedAt: msg.at };
          joinSelf();
          break;
        case 'leave': {
          const presence = { ...state.presence };
          delete presence[msg.uid];
          state = { ...state, presence };
          break;
        }
        case 'events':
          applyEvents(msg.events);
          break;
      }
      emit();
    };
  }

  // 가짜 청중: 리더 탭만 1~2초 간격으로 틱을 돌린다.
  const scheduleTick = () => {
    if (disposed) return;
    const delay = DEMO.tickMinMs + Math.random() * (DEMO.tickMaxMs - DEMO.tickMinMs);
    timer = setTimeout(() => {
      dispatch(crowdTick(bots, state, Math.random));
      scheduleTick();
    }, delay);
  };
  let releaseLock: (() => void) | undefined;
  const abort = new AbortController();
  if (typeof navigator !== 'undefined' && navigator.locks) {
    navigator.locks
      .request('bnw-demo-crowd', { signal: abort.signal }, () => {
        if (disposed) return;
        scheduleTick();
        return new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
      })
      .catch(() => undefined);
  } else if (role === 'screen') {
    scheduleTick();
  }

  const onPageHide = () => send({ type: 'leave', uid });
  window.addEventListener('pagehide', onPageHide);

  joinSelf();
  emit();
  send({ type: 'hello' });

  return {
    kind: 'demo',
    getSnapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    answer(round: 1 | 2, q: QuestionId, value: boolean) {
      if (!isRoundOpen(round, state.phase)) return;
      if (round === 2 && q !== 'q4') return;
      dispatch([{ type: 'answer', round, uid, q, value }]);
    },
    async setPhase(phase: Phase) {
      const prev = state.phase;
      // 라운드를 닫을 때 남은 가짜 응답을 채워 결과 화면이 목표 비율을 보이게 한다.
      if (prev === 'round1' && phase === 'closed1') dispatch(crowdFlush(bots, state, 1));
      if (prev === 'round2' && phase === 'ended') dispatch(crowdFlush(bots, state, 2));
      const at = Math.max(Date.now(), state.updatedAt + 1);
      state = { ...state, phase, updatedAt: at };
      send({ type: 'phase', phase, at });
      emit();
    },
    async reset() {
      const at = Math.max(Date.now(), state.updatedAt + 1);
      state = { ...freshState(), updatedAt: at };
      send({ type: 'reset', at });
      joinSelf();
      emit();
    },
    async signIn() {},
    async signOut() {},
    dispose() {
      disposed = true;
      clearTimeout(timer);
      abort.abort();
      releaseLock?.();
      window.removeEventListener('pagehide', onPageHide);
      send({ type: 'leave', uid });
      channel?.close();
      listeners.clear();
    },
  };
}
