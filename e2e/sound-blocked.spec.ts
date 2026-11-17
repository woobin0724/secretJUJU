import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { ...exe, args: ['--autoplay-policy=document-user-activation-required'] },
});

test.describe('소리 버튼 (브라우저가 자동재생을 막을 때)', () => {
  test('저장값이 켬이어도 꺼진 상태로 보여 주고, 버튼을 누르면 켜진다', async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => localStorage.setItem('bnw:sound', '1'));
    await page.goto('#/?demo=1');
    await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
    const btn = page.locator('.sound-toggle');
    await page.waitForTimeout(1200);
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveAttribute('data-track', '');
    expect(await page.evaluate(() => localStorage.getItem('bnw:sound'))).toBe('1'); // 저장값은 그대로

    await btn.click(); // 사용자 동작 → 재생 가능
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveAttribute('data-track', 'city');
    expect(errors).toEqual([]);
  });
});
