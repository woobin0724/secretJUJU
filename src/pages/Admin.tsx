import { useState, type FormEvent } from 'react';
import { DemoBadge, Loading, NoConfig, OfflineBanner } from '../components/Chrome';
import { TEXT } from '../content';
import { useOffline } from '../hooks';
import { respondentCount, tally } from '../logic/aggregate';
import { nextPhase, prevPhase } from '../logic/phase';
import type { Store } from '../store/types';
import { useStore } from '../store/useStore';
import './admin.css';

const A = TEXT.admin;

function Login({ store }: { store: Store }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await store.signIn(email, password);
    } catch (err) {
      setError(err instanceof Error && err.message === 'not-admin' ? A.notAdmin : A.loginFail);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="admin-card" onSubmit={submit}>
      <label>
        {A.email}
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        {A.password}
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="admin-error">{error}</p>}
      <button className="btn primary" disabled={busy}>
        {A.login}
      </button>
    </form>
  );
}

function ResetDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [word, setWord] = useState('');
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog">
        {stage === 1 ? (
          <>
            <h2>{A.resetConfirm1}</h2>
            <p>{A.resetConfirm1Body}</p>
            <div className="dialog-actions">
              <button className="btn" onClick={onCancel}>
                {A.cancel}
              </button>
              <button className="btn danger" onClick={() => setStage(2)}>
                {A.proceed}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{A.resetConfirm2}</h2>
            <input autoFocus value={word} onChange={(e) => setWord(e.target.value)} placeholder={A.resetWord} autoCapitalize="characters" autoComplete="off" />
            <div className="dialog-actions">
              <button className="btn" onClick={onCancel}>
                {A.cancel}
              </button>
              <button className="btn danger" disabled={word.trim() !== A.resetWord} onClick={onConfirm}>
                {A.doReset}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const { store, snap, status, demo } = useStore('admin');
  const offline = useOffline(snap.connected, status === 'ready');
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'noconfig') return <NoConfig />;
  if (status === 'loading' || !store) return <Loading />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError(A.failed);
    } finally {
      setBusy(false);
    }
  };

  const authed = snap.user?.isAdmin === true;
  const next = nextPhase(snap.phase);
  const prev = prevPhase(snap.phase);
  const nextLabel = A.nextLabels[snap.phase];
  const q4r1 = tally(snap.all.round1, 'q4');
  const q4r2 = tally(snap.all.round2, 'q4');
  const pct = (p: number | null) => (p === null ? '–' : `${p}%`);

  return (
    <div className="admin">
      <header>
        <h1>{A.title}</h1>
        {authed && !demo && (
          <button className="link" onClick={() => void store.signOut()}>
            {A.logout}
          </button>
        )}
      </header>

      {!authed ? (
        <Login store={store} />
      ) : (
        <>
          <section className="admin-card phase">
            <span className="k">{A.current}</span>
            <strong data-testid="admin-phase">{A.phaseNames[snap.phase]}</strong>
          </section>

          {next && nextLabel && (
            <button className="btn primary next" disabled={busy} onClick={() => void run(() => store.setPhase(next))}>
              {nextLabel}
            </button>
          )}
          {prev && (
            <button className="link back" disabled={busy} onClick={() => void run(() => store.setPhase(prev))}>
              {A.back}
            </button>
          )}
          {error && <p className="admin-error">{error}</p>}

          <section className="admin-card stats">
            <div>
              <span className="k">{A.online}</span>
              <strong>{snap.presence}</strong>
            </div>
            <div>
              <span className="k">{A.round1}</span>
              <strong>{respondentCount(snap.all.round1)}</strong>
            </div>
            <div>
              <span className="k">{A.round2}</span>
              <strong>{respondentCount(snap.all.round2)}</strong>
            </div>
          </section>

          <section className="admin-card stats two">
            <div>
              <span className="k">
                {A.q4Preview} · {TEXT.screen.before}
              </span>
              <strong>{pct(q4r1.pct)}</strong>
              <span className="k">
                {q4r1.yes}/{q4r1.total}
              </span>
            </div>
            <div>
              <span className="k">
                {A.q4Preview} · {TEXT.screen.after}
              </span>
              <strong className="accent">{pct(q4r2.pct)}</strong>
              <span className="k">
                {q4r2.yes}/{q4r2.total}
              </span>
            </div>
          </section>

          <button className="link danger-link" onClick={() => setResetting(true)}>
            {A.reset}
          </button>
        </>
      )}

      {resetting && (
        <ResetDialog
          onCancel={() => setResetting(false)}
          onConfirm={() => {
            setResetting(false);
            void run(() => store.reset());
          }}
        />
      )}
      {offline && <OfflineBanner />}
      {demo && <DemoBadge />}
    </div>
  );
}
