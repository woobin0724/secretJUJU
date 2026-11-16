/** 주소의 쿼리를 읽는다. HashRouter 라서 `/#/screen?demo=1` 과 `/?demo=1#/screen` 둘 다 받는다. */
export function urlParams(loc: Pick<Location, 'search' | 'hash'> = window.location): URLSearchParams {
  const params = new URLSearchParams(loc.search);
  const i = loc.hash.indexOf('?');
  if (i >= 0) new URLSearchParams(loc.hash.slice(i + 1)).forEach((v, k) => params.set(k, v));
  return params;
}

export function isDemo(): boolean {
  const v = urlParams().get('demo');
  return v !== null && v !== '0';
}

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const adminEmail = ((env.VITE_ADMIN_EMAIL as string | undefined) ?? '').trim().toLowerCase();

export function hasFirebaseConfig(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
}

/** QR에 넣을 청중용 주소. `?qr=` 로 덮어쓸 수 있고, 기본은 현재 배포 주소의 청중 경로(쿼리 제외). */
export function audienceUrl(loc: Pick<Location, 'search' | 'hash' | 'origin' | 'pathname'> = window.location): string {
  const override = urlParams(loc).get('qr');
  if (override) return override;
  return `${loc.origin}${loc.pathname}#/`;
}

export function mediaUrl(file: string): string {
  return `${env.BASE_URL}media/${file}`;
}
