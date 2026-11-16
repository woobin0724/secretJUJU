// public/media 의 mp4 중 같은 이름의 jpg(포스터)가 없는 것은 ffmpeg 로 첫 프레임을 뽑아 만든다.
// ffmpeg 가 없으면 아무것도 하지 않는다(앱은 단색 배경으로 대체한다).
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'media');
if (existsSync(dir)) {
  const missing = readdirSync(dir)
    .filter((f) => f.endsWith('.mp4'))
    .filter((f) => !existsSync(join(dir, f.replace(/\.mp4$/, '.jpg'))));
  const hasFfmpeg = missing.length > 0 && spawnSync('ffmpeg', ['-version']).status === 0;
  for (const f of missing) {
    if (!hasFfmpeg) {
      console.log(`[media] ffmpeg 없음: ${f} 의 포스터를 만들지 않습니다(단색으로 대체).`);
      continue;
    }
    const out = join(dir, f.replace(/\.mp4$/, '.jpg'));
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, f), '-frames:v', '1', '-q:v', '4', out]);
    console.log(r.status === 0 ? `[media] 포스터 생성: ${out}` : `[media] 포스터 생성 실패: ${f}`);
  }
}
