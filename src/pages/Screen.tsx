import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DemoBadge, NoConfig, OfflineBanner } from '../components/Chrome';
import { TEXT } from '../content';
import { useDemoKeys, useOffline, useTween } from '../hooks';
import { compareRounds, respondentsForPhase, tally, tallyAll, type Tally } from '../logic/aggregate';
import { audienceUrl } from '../mode';
import { useStore } from '../store/useStore';
import { QUESTION_IDS } from '../types';
import './screen.css';

function Qr({ url, size }: { url: string; size: 'big' | 'small' }) {
  return (
    <div className={`qr ${size}`}>
      <QRCodeSVG value={url} level="M" bgColor="#F3EDE2" fgColor="#141414" marginSize={2} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

/** 주소가 길면 '/' 뒤에서만 줄을 바꾼다. */
function Url({ text, small }: { text: string; small?: boolean }) {
  const parts = text.split('/');
  return (
    <p className={`url${small ? ' small' : ''}`}>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && '/'}
          <wbr />
        </span>
      ))}
    </p>
  );
}

function Pct({ value, className = '' }: { value: number; className?: string }) {
  const v = useTween(value);
  return (
    <span className={`pct ${className}`}>
      {Math.round(v)}
      <small>%</small>
    </span>
  );
}

function Bar({ label, t }: { label: string; t: Tally }) {
  return (
    <div className="bar-row" data-testid="bar-row">
      <div className="bar-num">{t.pct === null ? <span className="pct dim">–</span> : <Pct value={t.pct} />}</div>
      <div className="bar-body">
        <div className="bar-label">{label}</div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${t.pct ?? 0}%` }} />
        </div>
        <div className="bar-meta">{t.total === 0 ? TEXT.screen.empty : `${TEXT.screen.yesLabel} ${t.yes}명 · ${TEXT.screen.people(t.total)}`}</div>
      </div>
    </div>
  );
}

export default function Screen() {
  const { store, snap, status, demo } = useStore('screen');
  useDemoKeys(store, demo);
  const offline = useOffline(snap.connected, status === 'ready');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F' && e.key !== 'ㄹ') return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'noconfig') return <NoConfig />;

  const url = audienceUrl();
  const shortUrl = url.replace(/^https?:\/\//, '').replace(/#\/$/, '');
  const { phase, all } = snap;
  const r1 = tallyAll(all.round1);
  const r1q4 = r1.q4;
  const r2q4 = tally(all.round2, 'q4');
  const cmp = compareRounds(all.round1, all.round2);

  return (
    <div className="screen" data-phase={phase}>
      <header className="screen-head">
        <span className="brand">{TEXT.waiting.motto}</span>
        <span className="counts" data-testid="counts">
          {TEXT.screen.counts(snap.presence, respondentsForPhase(phase, all.round1, all.round2))}
        </span>
      </header>

      <main key={phase} className="screen-main fade">
        {phase === 'waiting' && (
          <div className="s-waiting">
            <Qr url={url} size="big" />
            <Url text={shortUrl} />
            <p className="scan">{TEXT.screen.scan}</p>
          </div>
        )}

        {phase === 'round1' && (
          <div className="s-split">
            <aside>
              <Qr url={url} size="small" />
              <Url text={shortUrl} small />
            </aside>
            <section className="bars">
              {QUESTION_IDS.map((q) => (
                <Bar key={q} label={TEXT.questionShort[q]} t={r1[q]} />
              ))}
            </section>
          </div>
        )}

        {phase === 'closed1' && (
          <div className="s-center">
            {r1q4.pct === null ? (
              <p className="empty">{TEXT.screen.empty}</p>
            ) : (
              <>
                <p className="big-label">{TEXT.screen.closedLabel}</p>
                <Pct value={r1q4.pct} className="huge" />
                <p className="meta">{TEXT.screen.people(r1q4.total)}</p>
              </>
            )}
          </div>
        )}

        {phase === 'round2' && (
          <div className="s-split">
            <aside>
              <Qr url={url} size="small" />
              <Url text={shortUrl} small />
            </aside>
            <section className="bars one">
              <p className="tag">{TEXT.screen.round2Title}</p>
              <p className="serif recheck-q">{TEXT.recheck.question}</p>
              <Bar label={TEXT.questionShort.q4} t={r2q4} />
            </section>
          </div>
        )}

        {phase === 'ended' && (
          <div className="s-ended">
            <div className="versus">
              <div>
                <p className="big-label">{TEXT.screen.before}</p>
                {cmp.before.pct === null ? <p className="empty">{TEXT.screen.empty}</p> : <Pct value={cmp.before.pct} className="large" />}
              </div>
              <div className="arrow" aria-hidden="true" />
              <div>
                <p className="big-label accent">{TEXT.screen.after}</p>
                {cmp.after.pct === null ? <p className="empty">{TEXT.screen.empty}</p> : <Pct value={cmp.after.pct} className="large accent" />}
              </div>
            </div>
            <p className="versus-caption">{TEXT.screen.closedLabel}</p>
            <p className="serif farewell">{TEXT.exit.title}</p>
          </div>
        )}
      </main>

      {offline && <OfflineBanner />}
      {demo && <DemoBadge />}
    </div>
  );
}
