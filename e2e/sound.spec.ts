import { expect, test } from '@playwright/test';
import { expectFits, shot, watchErrors } from './helpers';

const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { ...exe, args: ['--autoplay-policy=no-user-gesture-required'] },
});

test.describe('소리 버튼 (자동재생 허용)', () => {
  test('기본은 꺼짐, 켜면 장면 소리가 나오고 장면을 따라 바뀌며 새로고침해도 유지된다', async ({ page }) => {
    const errors = watchErrors(page);
    const mp3: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('.mp3')) mp3.push(r.url().split('/').pop()!);
    });

    await page.goto('#/?demo=1');
    await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
    const btn = page.locator('.sound-toggle');

    // 기본값: 꺼짐. 소리 파일은 받지도 않는다.
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveAttribute('aria-label', '소리 켜기');
    await expect(btn).toHaveAttribute('data-track', '');
    const box = (await btn.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(390 - 70); // 오른쪽 위
    expect(box.y).toBeLessThan(80);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(mp3).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('bnw:sound'))).toBeNull();
    await shot(page, 'm20-sound-off');

    // 켜기
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveAttribute('aria-label', '소리 끄기');
    await expect(btn).toHaveAttribute('data-track', 'city');
    expect(mp3).toEqual(['city-castes.mp3']);
    expect(await page.evaluate(() => localStorage.getItem('bnw:sound'))).toBe('1');
    await shot(page, 'm21-sound-on');

    // 장면이 바뀌면 소리도 바뀐다
    await page.keyboard.press('ArrowRight');
    await expect(btn).toHaveAttribute('data-track', 'arrival');
    await page.getByRole('button', { name: '심사 시작' }).click();
    await expect(btn).toHaveAttribute('data-track', 'sorting');
    await expectFits(page);
    await shot(page, 'm22-sound-question');
    // 같은 장면(Q1 → Q2)에서는 소리를 다시 받지 않는다
    await page.getByRole('button', { name: '예', exact: true }).click();
    await expect(page.getByText('심사 2/4')).toBeVisible();
    await expect(btn).toHaveAttribute('data-track', 'sorting');
    expect(mp3.filter((f) => f === 'scene-2-sorting.mp3')).toHaveLength(1);

    // 탭이 백그라운드로 가면 일시정지, 돌아오면 이어서 재생
    const state = () => page.evaluate(() => (window as unknown as { __bnwAudioState?: () => string }).__bnwAudioState?.());
    expect(await state()).toBe('running');
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await setHidden(true);
    await expect.poll(state).toBe('suspended');
    await setHidden(false);
    await expect.poll(state).toBe('running');

    // 새로고침해도 켜진 상태가 유지된다
    // (탭 하나뿐인 데모는 새로고침하면 대기 화면으로 돌아간다)
    await page.reload();
    await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveAttribute('data-track', 'city');

    // 끄기: 저장되고, 새로고침해도 꺼져 있다
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveAttribute('data-track', '');
    expect(await page.evaluate(() => localStorage.getItem('bnw:sound'))).toBe('0');
    await page.reload();
    await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
    await page.waitForTimeout(800);
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    expect(errors).toEqual([]);
  });

  test('출국 소리는 반복하지 않고, mp3 가 없거나 깨져도 조용히 넘어간다', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.route('**/media/city-castes.mp3', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/media/scene-1-arrival.mp3', (r) => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'not an mp3' }));

    await page.goto('#/?demo=1');
    await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
    const btn = page.locator('.sound-toggle');
    await btn.click();
    // 파일이 없어도 버튼은 켜지고, 나오는 소리만 없다
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveAttribute('data-track', '');
    await page.keyboard.press('ArrowRight'); // 입국장: 깨진 파일
    await expect(page.getByRole('button', { name: '심사 시작' })).toBeVisible();
    await page.waitForTimeout(800);
    await expect(btn).toHaveAttribute('data-track', '');

    // 종료 → 출국 장면: 한 번만 재생
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('하나라도 망설이셨다면, 출국을 환영합니다.')).toBeVisible();
    await expect(btn).toHaveAttribute('data-track', 'exit');
    expect(await page.evaluate(() => (window as unknown as { __bnwAudioLoop?: () => boolean | null }).__bnwAudioLoop?.())).toBe(false);
    expect(pageErrors).toEqual([]);
  });

  test('혼자 해보기에도 소리 버튼이 있고, 발표·진행자 화면에는 없다', async ({ page }) => {
    const mp3: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('.mp3')) mp3.push(r.url());
    });
    await page.goto('#/solo');
    const btn = page.locator('.sound-toggle');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('data-track', 'arrival');

    // 켜 둔 채로 발표·진행자 화면에 가도 소리 버튼도, 소리도 없다
    mp3.length = 0;
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('#/screen?demo=1');
    await expect(page.locator('.screen')).toHaveAttribute('data-phase', 'waiting');
    await expect(page.locator('.sound-toggle')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
    await page.goto('#/admin?demo=1');
    await expect(page.getByTestId('admin-phase')).toBeVisible();
    await expect(page.locator('.sound-toggle')).toHaveCount(0);
    expect(mp3).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __bnwAudioState?: () => string }).__bnwAudioState?.())).not.toBe('running');
  });
});
