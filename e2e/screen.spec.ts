import { expect, test, type Page } from '@playwright/test';
import { expectFits, shot, watchErrors } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

/** 보이는 글자 중 가장 작은 글씨 크기(DEMO 표시는 제외). */
async function minFontSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    let min = Infinity;
    document.querySelectorAll('.screen *').forEach((el) => {
      if (el.closest('.demo-badge') || el.closest('svg')) return;
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '');
      if (!own) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
    });
    return min;
  });
}

async function check(page: Page, name: string) {
  await expectFits(page);
  expect(await minFontSize(page), '본문 최소 32px').toBeGreaterThanOrEqual(32);
  await shot(page, name);
}

test('발표 화면: 키보드로 모든 단계를 넘긴다', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('#/screen?demo=1');
  const phase = page.locator('.screen');

  // waiting
  await expect(phase).toHaveAttribute('data-phase', 'waiting');
  await expect(page.getByText('휴대폰 카메라로 QR을 찍어 입국 심사를 받아 주세요')).toBeVisible();
  const qr = await page.locator('.qr.big').boundingBox();
  expect(qr!.width).toBeGreaterThanOrEqual(520);
  await expect(page.locator('.url')).toHaveText('localhost:4173/secretJUJU/');
  await expect(page.getByTestId('counts')).toContainText('응답 0명');
  await check(page, 'p01-waiting');

  // round1: 응답이 없을 때
  await page.keyboard.press('ArrowRight');
  await expect(phase).toHaveAttribute('data-phase', 'round1');
  await expect(page.getByTestId('bar-row')).toHaveCount(4);
  await expect(page.getByText('아직 응답이 없습니다').first()).toBeVisible();
  await page.screenshot({ path: 'qa/p02-round1-empty.png' });

  // 가짜 청중이 서서히 쌓인다
  await expect
    .poll(async () => Number((await page.getByTestId('counts').textContent())!.match(/응답 (\d+)명/)![1]), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(6);
  const mid = Number((await page.getByTestId('counts').textContent())!.match(/응답 (\d+)명/)![1]);
  expect(mid).toBeLessThan(48);
  const num = parseFloat(await page.locator('.bar-num .pct').first().evaluate((el) => getComputedStyle(el).fontSize));
  expect(num, '숫자 최소 160px').toBeGreaterThanOrEqual(160);
  await check(page, 'p03-round1');

  // closed1: Q4 하나만 크게, 약 62%
  await page.keyboard.press('ArrowRight');
  await expect(phase).toHaveAttribute('data-phase', 'closed1');
  await expect(page.getByText('버튼을 누른다')).toBeVisible();
  await expect(page.locator('.pct.huge')).toHaveText(/^6[123]%$/);
  await expect(page.getByText('48명 응답')).toBeVisible();
  await check(page, 'p04-closed1');

  // round2
  await page.keyboard.press('ArrowRight');
  await expect(phase).toHaveAttribute('data-phase', 'round2');
  await expect(page.getByTestId('bar-row')).toHaveCount(1);
  await expect
    .poll(async () => Number((await page.getByTestId('counts').textContent())!.match(/응답 (\d+)명/)![1]), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(8);
  await check(page, 'p05-round2');

  // ended: 처음 62% / 지금 41%
  await page.keyboard.press('ArrowRight');
  await expect(phase).toHaveAttribute('data-phase', 'ended');
  await expect(page.locator('.pct.large').first()).toHaveText(/^6[123]%$/);
  await expect(page.locator('.pct.large.accent')).toHaveText(/^4[012]%$/);
  await expect(page.getByText('하나라도 망설이셨다면, 출국을 환영합니다.')).toBeVisible();
  await check(page, 'p06-ended');

  // 더 넘어가지 않고, ← 로 되돌아가며, R 로 초기화된다
  await page.keyboard.press('ArrowRight');
  await expect(phase).toHaveAttribute('data-phase', 'ended');
  await page.keyboard.press('ArrowLeft');
  await expect(phase).toHaveAttribute('data-phase', 'round2');
  await page.keyboard.press('r');
  await expect(phase).toHaveAttribute('data-phase', 'waiting');
  await expect(page.getByTestId('counts')).toContainText('응답 0명');

  // ?qr= 로 QR 주소를 덮어쓴다
  await page.goto('#/screen?demo=1&qr=https%3A%2F%2Fexample.kr%2Fbnw');
  await expect(page.locator('.url')).toHaveText('example.kr/bnw');

  expect(errors).toEqual([]);
});

test('발표 화면: 응답이 0건이면 0으로 나누지 않는다', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('#/screen?demo=1');
  await expect(page.locator('.screen')).toHaveAttribute('data-phase', 'waiting');
  // 1라운드를 거치지 않고(응답 0건) 다른 탭이 재심사 단계로 보낸 상황을 만든 뒤, 마감 화면으로 되돌아가 본다
  await page.evaluate(() => {
    const ch = new BroadcastChannel('bnw-demo');
    ch.postMessage({ type: 'phase', phase: 'round2', at: Date.now() + 1000 });
    ch.close();
  });
  await expect(page.locator('.screen')).toHaveAttribute('data-phase', 'round2');
  await page.keyboard.press('ArrowLeft'); // closed1 (1라운드 응답 0건)
  await expect(page.locator('.screen')).toHaveAttribute('data-phase', 'closed1');
  await expect(page.getByText('아직 응답이 없습니다')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
  await shot(page, 'p07-closed1-empty');
  expect(errors).toEqual([]);
});

test('진행자 화면(데모): 단계 버튼과 2단계 초기화', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('#/admin?demo=1');
  await expect(page.getByTestId('admin-phase')).toHaveText('대기 (QR 안내)');
  await shot(page, 'a01-admin-waiting');
  await page.getByRole('button', { name: '1라운드 열기' }).click();
  await expect(page.getByTestId('admin-phase')).toHaveText('1라운드 진행 중');
  await page.getByRole('button', { name: '1라운드 닫기' }).click();
  await page.getByRole('button', { name: '재심사 열기' }).click();
  await page.getByRole('button', { name: '종료', exact: true }).click();
  await expect(page.getByTestId('admin-phase')).toHaveText('종료');
  await shot(page, 'a02-admin-ended');
  await page.getByRole('button', { name: '이전 단계로 되돌리기' }).click();
  await expect(page.getByTestId('admin-phase')).toHaveText('재심사 진행 중');

  await page.getByRole('button', { name: '전체 초기화' }).click();
  await expect(page.getByText('정말 초기화합니까?')).toBeVisible();
  await page.getByRole('button', { name: '계속' }).click();
  const confirm = page.getByRole('button', { name: '초기화', exact: true });
  await expect(confirm).toBeDisabled();
  await shot(page, 'a03-admin-reset');
  await page.getByPlaceholder('INIT').fill('INIT');
  await confirm.click();
  await expect(page.getByTestId('admin-phase')).toHaveText('대기 (QR 안내)');
  expect(errors).toEqual([]);
});
