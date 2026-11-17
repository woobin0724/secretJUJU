import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SceneKey } from '../config';
import { TEXT } from '../content';
import {
  currentTrack,
  disableSound,
  enableSound,
  readSoundPref,
  restoreSound,
  setSoundScene,
  soundAvailable,
  subscribeSound,
  writeSoundPref,
} from '../sound';

/** 청중 화면 오른쪽 위의 소리 켜기/끄기 버튼. 기본은 꺼짐. */
export function SoundToggle({ scene }: { scene: SceneKey }) {
  const [on, setOn] = useState(false);
  const track = useSyncExternalStore(subscribeSound, currentTrack, () => null);

  // 저장된 '켬' 상태를 되살린다. 브라우저가 자동재생을 막으면 꺼진 상태로 보여 준다(저장값은 그대로 둔다).
  useEffect(() => {
    if (!soundAvailable || !readSoundPref()) return;
    let alive = true;
    void restoreSound().then((ok) => {
      if (alive && ok) setOn(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setSoundScene(scene);
  }, [scene]);

  // 청중 화면을 떠나면(발표·진행자 화면 등) 소리를 멈춘다.
  useEffect(() => () => disableSound(), []);

  if (!soundAvailable) return null;

  const toggle = () => {
    if (on) {
      setOn(false);
      writeSoundPref(false);
      disableSound();
      return;
    }
    // 사용자 동작 안에서 바로 호출해야 아이폰·안드로이드에서 소리가 난다.
    void enableSound().then((ok) => {
      setOn(ok);
      if (ok) writeSoundPref(true);
    });
  };

  const label = on ? TEXT.sound.off : TEXT.sound.on;
  return (
    <button type="button" className="sound-toggle" aria-pressed={on} aria-label={label} title={label} data-track={track ?? ''} onClick={toggle}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" stroke="none" />
        {on ? (
          <>
            <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
            <path d="M18 6.5a7.8 7.8 0 0 1 0 11" />
          </>
        ) : (
          <>
            <path d="M16 9.5l5 5" />
            <path d="M21 9.5l-5 5" />
          </>
        )}
      </svg>
    </button>
  );
}
