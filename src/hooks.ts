import { useEffect, useRef, useState } from 'react';
import { NUMBER_TWEEN_MS } from './config';
import { nextPhase, prevPhase } from './logic/phase';
import type { Store } from './store/types';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** 숫자가 바뀌면 0.5초 동안 부드럽게 따라간다. */
export function useTween(target: number, duration = NUMBER_TWEEN_MS): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** 데모 모드 키보드: → 다음 단계, ← 이전 단계, R 초기화. */
export function useDemoKeys(store: Store | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !store) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const phase = store.getSnapshot().phase;
      if (e.key === 'ArrowRight') {
        const n = nextPhase(phase);
        if (n) void store.setPhase(n);
      } else if (e.key === 'ArrowLeft') {
        const p = prevPhase(phase);
        if (p) void store.setPhase(p);
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') {
        void store.reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, enabled]);
}

/** 연결이 3초 넘게 끊겨 있을 때만 true (잠깐의 깜빡임은 무시). */
export function useOffline(connected: boolean, active: boolean): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!active || connected) {
      setOffline(false);
      return;
    }
    const t = setTimeout(() => setOffline(true), 3000);
    return () => clearTimeout(t);
  }, [connected, active]);
  return offline;
}
