import { existsSync, readdirSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // 없는 미디어 파일은 아예 요청하지 않도록(콘솔 404 방지) 빌드 시점의 파일 목록을 넘긴다.
  const media = existsSync('public/media') ? readdirSync('public/media') : [];
  return {
    base: env.VITE_BASE || '/brave-new-world/',
    plugins: [react()],
    define: { __MEDIA_FILES__: JSON.stringify(media) },
    build: { target: 'es2020' },
  };
});
