import { DemoBadge, Loading, NoConfig, OfflineBanner } from '../components/Chrome';
import { Journey } from '../components/Journey';
import { useDemoKeys, useOffline } from '../hooks';
import { useStore } from '../store/useStore';

export default function Audience() {
  const { store, snap, status, demo } = useStore('audience');
  useDemoKeys(store, demo);
  const offline = useOffline(snap.connected, status === 'ready');

  if (status === 'noconfig') return <NoConfig />;
  if (status === 'loading' || !store) return <Loading error={snap.error === 'auth'} />;
  return (
    <>
      <Journey mode="live" phase={snap.phase} mine={snap.mine} onAnswer={(round, q, v) => store.answer(round, q, v)} />
      {offline && <OfflineBanner />}
      {demo && <DemoBadge />}
    </>
  );
}
