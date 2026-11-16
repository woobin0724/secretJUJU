import { TEXT } from '../content';

export function DemoBadge() {
  return <div className="demo-badge">{TEXT.system.demo}</div>;
}

export function OfflineBanner() {
  return (
    <div className="offline" role="status">
      {TEXT.system.offline}
    </div>
  );
}

/** Firebase 설정이 비어 있을 때 죽지 않고 보여 주는 안내. */
export function NoConfig() {
  return (
    <div className="stage">
      <main className="panel">
        <div className="mid center">
          <h1 className="serif lead">{TEXT.system.noConfigTitle}</h1>
          <p className="note">{TEXT.system.noConfig}</p>
        </div>
      </main>
    </div>
  );
}

export function Loading({ error }: { error?: boolean }) {
  return (
    <div className="stage">
      <main className="panel">
        <div className="mid center">
          <p className="note">{error ? TEXT.system.authError : TEXT.system.loading}</p>
        </div>
      </main>
    </div>
  );
}
