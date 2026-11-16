import { useEffect, useState } from 'react';
import { adminEmail, firebaseConfig, hasFirebaseConfig, isDemo } from '../mode';
import { createDemoStore } from './demoStore';
import { EMPTY_SNAPSHOT, type Role, type Snapshot, type Store } from './types';

export type StoreStatus = 'loading' | 'ready' | 'noconfig';

/** 주소에 따라 데모 저장소 또는 Firebase 저장소를 만들고 구독한다. */
export function useStore(role: Role): { store: Store | null; snap: Snapshot; status: StoreStatus; demo: boolean } {
  const demo = isDemo();
  const configured = hasFirebaseConfig();
  const [store, setStore] = useState<Store | null>(null);
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!demo && !configured) return;
    let cancelled = false;
    let current: Store | null = null;
    const attach = (s: Store) => {
      current = s;
      setStore(s);
      setSnap(s.getSnapshot());
      s.subscribe(() => setSnap(s.getSnapshot()));
    };
    if (demo) {
      attach(createDemoStore(role));
    } else {
      // Firebase SDK 는 필요할 때만 불러온다(데모·혼자 해보기에서는 받지 않는다).
      import('./firebaseStore').then((m) => {
        if (!cancelled) attach(m.createFirebaseStore(role, firebaseConfig, adminEmail));
      });
    }
    return () => {
      cancelled = true;
      current?.dispose();
      setStore(null);
    };
  }, [demo, configured, role]);

  const status: StoreStatus = !demo && !configured ? 'noconfig' : store && snap.ready ? 'ready' : 'loading';
  return { store, snap, status, demo };
}
