import { useState } from 'react';
import { Journey } from '../components/Journey';
import type { Answers, Phase } from '../types';

/** 발표가 끝난 뒤 혼자 해보는 모드. 서버에 아무것도 쓰지 않고 메모리에서만 진행한다. */
export default function Solo() {
  const [phase, setPhase] = useState<Phase>('round1');
  const [mine, setMine] = useState<{ round1: Answers; round2: Answers }>({ round1: {}, round2: {} });
  return (
    <Journey
      mode="solo"
      phase={phase}
      mine={mine}
      onAnswer={(round, q, v) =>
        setMine((m) => (round === 1 ? { ...m, round1: { ...m.round1, [q]: v } } : { ...m, round2: { ...m.round2, [q]: v } }))
      }
      onRecheck={phase === 'round1' ? () => setPhase('round2') : undefined}
    />
  );
}
