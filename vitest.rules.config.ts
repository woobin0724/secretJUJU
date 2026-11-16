import { defineConfig } from 'vitest/config';

// 보안 규칙 테스트 전용 설정(에뮬레이터 필요). firebase 패키지가 한 벌만 로드되도록 인라인한다.
export default defineConfig({
  test: {
    dir: 'rules-test',
    environment: 'node',
    fileParallelism: false,
    server: { deps: { inline: [/firebase/] } },
  },
});
