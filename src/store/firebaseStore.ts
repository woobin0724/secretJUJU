import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { getDatabase, onDisconnect, onValue, ref, serverTimestamp, set, update, type Unsubscribe } from 'firebase/database';
import { isPhase } from '../logic/phase';
import { QUESTION_IDS, type Answers, type Phase, type QuestionId, type ResponseMap } from '../types';
import { EMPTY_SNAPSHOT, type Role, type Snapshot, type Store } from './types';

interface Pending {
  uid: string;
  round: 1 | 2;
  q: QuestionId;
  value: boolean;
  at: number;
}

const PENDING_KEY = 'bnw:pending';
const PENDING_MAX_AGE = 2 * 60 * 60 * 1000;

function loadPending(): Pending[] {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') as Pending[];
    return Array.isArray(list) ? list.filter((p) => Date.now() - p.at < PENDING_MAX_AGE) : [];
  } catch {
    return [];
  }
}

function savePending(list: Pending[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* 저장소를 쓸 수 없어도 SDK 의 메모리 큐가 재전송한다 */
  }
}

function toAnswers(v: unknown): Answers {
  const out: Answers = {};
  if (v && typeof v === 'object') {
    for (const q of QUESTION_IDS) {
      const a = (v as Record<string, unknown>)[q];
      if (typeof a === 'boolean') out[q] = a;
    }
  }
  return out;
}

function toResponseMap(v: unknown): ResponseMap {
  const out: ResponseMap = {};
  if (v && typeof v === 'object') {
    for (const [uid, a] of Object.entries(v as Record<string, unknown>)) out[uid] = toAnswers(a);
  }
  return out;
}

export function createFirebaseStore(role: Role, config: FirebaseOptions, adminEmail: string): Store {
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);

  let snap: Snapshot = { ...EMPTY_SNAPSHOT, connected: false };
  const loaded = { state: false, auth: false, r1: false, r2: false };
  const listeners = new Set<() => void>();
  const baseUnsubs: Unsubscribe[] = [];
  let userUnsubs: Unsubscribe[] = [];
  let disposed = false;

  const patch = (p: Partial<Snapshot>) => {
    if (disposed) return;
    const ready = loaded.state && loaded.auth && (role !== 'audience' || (loaded.r1 && loaded.r2));
    snap = { ...snap, ...p, ready };
    listeners.forEach((l) => l());
  };

  const syncPresence = () => {
    if (role !== 'audience' || !snap.connected || !snap.uid) return;
    const node = ref(db, `presence/${snap.uid}`);
    onDisconnect(node)
      .remove()
      .then(() => set(node, true))
      .catch(() => undefined);
  };

  const write = (p: Pending) => {
    const done = () => savePending(loadPending().filter((x) => !(x.uid === p.uid && x.round === p.round && x.q === p.q)));
    // 오프라인이면 SDK 가 큐에 넣어 두었다가 다시 연결될 때 보낸다. 거절(마감·중복)되면 큐에서 뺀다.
    update(ref(db, `responses/round${p.round}/${p.uid}`), { [p.q]: p.value, at: serverTimestamp() }).then(done, done);
  };

  baseUnsubs.push(
    onValue(
      ref(db, 'state'),
      (s) => {
        const v = s.val() as { phase?: unknown } | null;
        loaded.state = true;
        patch({ phase: isPhase(v?.phase) ? v.phase : 'waiting' });
      },
      () => patch({ error: 'data' }),
    ),
    onValue(ref(db, '.info/connected'), (s) => {
      patch({ connected: s.val() === true });
      syncPresence();
    }),
    onAuthStateChanged(auth, (user) => {
      userUnsubs.forEach((u) => u());
      userUnsubs = [];
      if (!user) {
        loaded.auth = role === 'admin';
        loaded.r1 = loaded.r2 = false;
        patch({ uid: null, user: null, mine: { round1: {}, round2: {} }, all: { round1: {}, round2: {} }, presence: 0 });
        if (role !== 'admin') signInAnonymously(auth).catch(() => patch({ error: 'auth' }));
        return;
      }
      const email = user.email?.toLowerCase() ?? null;
      const isAdmin = adminEmail !== '' && email === adminEmail;
      loaded.auth = true;
      patch({ uid: user.uid, user: { email, isAdmin }, error: null });

      if (role === 'audience') {
        const uid = user.uid;
        userUnsubs.push(
          onValue(ref(db, `responses/round1/${uid}`), (s) => {
            loaded.r1 = true;
            patch({ mine: { ...snap.mine, round1: toAnswers(s.val()) } });
          }),
          onValue(ref(db, `responses/round2/${uid}`), (s) => {
            loaded.r2 = true;
            patch({ mine: { ...snap.mine, round2: toAnswers(s.val()) } });
          }),
          // 진행자가 전체 초기화를 하면 presence 도 지워지므로 다시 등록한다.
          onValue(ref(db, `presence/${uid}`), (s) => {
            if (s.val() !== true) syncPresence();
          }),
        );
        loadPending()
          .filter((p) => p.uid === uid)
          .forEach(write);
      } else if (role === 'screen' || isAdmin) {
        userUnsubs.push(
          onValue(
            ref(db, 'responses'),
            (s) => {
              const v = (s.val() ?? {}) as { round1?: unknown; round2?: unknown };
              patch({ all: { round1: toResponseMap(v.round1), round2: toResponseMap(v.round2) } });
            },
            () => patch({ error: 'data' }),
          ),
          onValue(ref(db, 'presence'), (s) => patch({ presence: s.exists() ? Object.keys(s.val() as object).length : 0 })),
        );
      }
    }),
  );

  return {
    kind: 'firebase',
    getSnapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    answer(round, q, value) {
      const uid = snap.uid;
      if (!uid) return;
      const p: Pending = { uid, round, q, value, at: Date.now() };
      savePending([...loadPending().filter((x) => !(x.uid === uid && x.round === round && x.q === q)), p]);
      write(p);
    },
    async setPhase(phase: Phase) {
      await set(ref(db, 'state'), { phase, updatedAt: serverTimestamp() });
    },
    async reset() {
      await update(ref(db), {
        state: { phase: 'waiting', updatedAt: serverTimestamp() },
        responses: null,
        presence: null,
      });
    },
    async signIn(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (adminEmail !== '' && cred.user.email?.toLowerCase() !== adminEmail) {
        await fbSignOut(auth);
        throw new Error('not-admin');
      }
    },
    async signOut() {
      await fbSignOut(auth);
    },
    dispose() {
      disposed = true;
      baseUnsubs.forEach((u) => u());
      userUnsubs.forEach((u) => u());
      listeners.clear();
    },
  };
}
