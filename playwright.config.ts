import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 150_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/secretJUJU/`,
    trace: 'off',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    // Firebase 설정 없이 빌드한 결과물로 데모 모드를 검증한다.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/secretJUJU/`,
    // .env.local 이 있어도 e2e 는 설정 없는 빌드로 돈다(실제 서버에 쓰지 않는다).
    env: { VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_DATABASE_URL: '', VITE_FIREBASE_PROJECT_ID: '' },
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
