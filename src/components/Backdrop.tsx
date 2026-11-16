import { useState } from 'react';
import { SCENES, type SceneKey } from '../config';
import { prefersReducedMotion } from '../hooks';
import { mediaUrl } from '../mode';

const available = new Set<string>(typeof __MEDIA_FILES__ === 'undefined' ? [] : __MEDIA_FILES__);
const has = (file: string) => available.has(file);

const keep: unknown[] = [];
const preloaded = new Set<SceneKey>();

/** 다음 장면의 포스터와 영상을 미리 받아 둔다. */
export function preloadScene(scene: SceneKey) {
  if (preloaded.has(scene)) return;
  preloaded.add(scene);
  const name = SCENES[scene];
  if (has(`${name}.jpg`)) {
    const img = new Image();
    img.src = mediaUrl(`${name}.jpg`);
    keep.push(img);
  }
  if (has(`${name}.mp4`) && !prefersReducedMotion()) {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = mediaUrl(`${name}.mp4`);
    v.load();
    keep.push(v);
  }
}

/**
 * 장면 배경. 영상 → jpg → 단색(#141414) 순서로 대체한다.
 * jpg 를 먼저 보여 주고 영상은 재생이 시작되면 페이드인한다. 소리는 없다.
 */
export function Backdrop({ scene, loop = true }: { scene: SceneKey; loop?: boolean }) {
  const name = SCENES[scene];
  const [imgOk, setImgOk] = useState(() => has(`${name}.jpg`));
  const [videoOk, setVideoOk] = useState(() => has(`${name}.mp4`) && !prefersReducedMotion());
  const [playing, setPlaying] = useState(false);

  return (
    <div className="backdrop" data-scene={name} data-layer={videoOk && playing ? 'video' : imgOk ? 'image' : 'solid'} aria-hidden="true">
      {imgOk && <img src={mediaUrl(`${name}.jpg`)} alt="" onError={() => setImgOk(false)} />}
      {videoOk && (
        <video
          className={playing ? 'on' : ''}
          src={mediaUrl(`${name}.mp4`)}
          poster={imgOk ? mediaUrl(`${name}.jpg`) : undefined}
          muted
          playsInline
          autoPlay
          loop={loop}
          preload="auto"
          onPlaying={() => setPlaying(true)}
          onError={() => setVideoOk(false)}
        />
      )}
      <div className="veil" />
    </div>
  );
}
