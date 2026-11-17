import { expect, test } from '@playwright/test';
import { expectFits, shot, watchErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('청중 화면: 대기 → 1라운드 → 섬 → 계급 판정 → 대기 → 재심사 → 출국', async ({ page, context }) => {
  const errors = watchErrors(page);
  // 같은 브라우저의 다른 탭(발표 화면)에서 단계를 넘긴다: BroadcastChannel 동기화 확인
  const control = await context.newPage();
  await control.goto('#/screen?demo=1');
  await page.goto('#/?demo=1');

  await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
  await expect(page.getByText('공동체 · 동일성 · 안정')).toBeVisible();
  await expect(page.getByText('DEMO')).toBeVisible();
  await expectFits(page);
  await shot(page, 'm01-waiting');

  await control.keyboard.press('ArrowRight'); // round1
  await expect(page.getByText('입국 심사를 시작합니다. 네 가지 질문에 답해 주십시오.')).toBeVisible();
  await expectFits(page);
  await shot(page, 'm02-arrival');
  await page.getByRole('button', { name: '심사 시작' }).click();

  await expect(page.getByText('심사 1/4')).toBeVisible();
  await expect(page.getByText('나는 언제나 행복하고 싶다')).toBeVisible();
  await expectFits(page);
  await shot(page, 'm03-q1');
  await page.getByRole('button', { name: '예', exact: true }).click();

  await expect(page.getByText('고민 없이 편하게 살고 싶다')).toBeVisible();
  await page.getByRole('button', { name: '아니오', exact: true }).click();
  await expect(page.getByText('심사 3/4')).toBeVisible();

  // 새로고침해도 이미 답한 문항은 다시 나오지 않는다
  await page.reload();
  await expect(page.getByText('남들과 같으면 마음이 놓인다')).toBeVisible();
  await expect(page.getByText('심사 3/4')).toBeVisible();
  await page.getByRole('button', { name: '예', exact: true }).click();

  await expect(page.getByText('버튼 하나로 평생 슬픔이 사라진다면, 누르시겠습니까?')).toBeVisible();
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scene', 'scene-3-hatchery');
  await expectFits(page);
  await shot(page, 'm04-q4');
  await page.getByRole('button', { name: '누른다', exact: true }).click();

  // 섬: 10초 동안 건너뛸 수 없다
  const islandStart = Date.now();
  await expect(page.getByText("신세계는 이런 공간을 '섬'이라 부르고, 이곳에 오는 사람을 추방했습니다.")).toBeVisible();
  await expect(page.getByTestId('island-text')).toHaveText('그 슬픔 속에 있던 사람들도 함께 지워집니다. 그래도 누르시겠습니까?');
  // 버튼은 소리 켜기/끄기 하나뿐이고, 눌러도 섬을 건너뛸 수 없다
  await expect(page.getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '소리 켜기' })).toBeVisible();
  await expect(page.getByRole('link')).toHaveCount(0);
  await expectFits(page);
  await shot(page, 'm05-island');
  await page.mouse.click(195, 420);
  await page.mouse.click(195, 780);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Space');
  await page.touchscreen.tap(300, 700);
  await page.waitForTimeout(4000);
  await expect(page.locator('.stage')).toHaveAttribute('data-step', 'island:q4');
  const count = Number(await page.getByTestId('island-count').textContent());
  expect(count).toBeGreaterThanOrEqual(3);
  expect(count).toBeLessThanOrEqual(7);

  await expect(page.getByTestId('island-text')).toHaveText('생각해 주셔서 감사합니다. 이 10초는 소마가 없는 시간이었습니다.', { timeout: 10_000 });
  expect(Date.now() - islandStart).toBeGreaterThanOrEqual(8500);
  await expect(page.locator('.stage')).toHaveAttribute('data-step', 'island:q4');
  await shot(page, 'm06-island-thanks');

  // 계급 판정
  await expect(page.getByText('당신의 계급을 판정합니다')).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - islandStart).toBeGreaterThanOrEqual(10_000);
  await expect(page.getByTestId('caste-slot')).toBeVisible();
  await page.screenshot({ path: 'qa/m07-caste-slot.png' });
  await expect(page.getByText('당신의 계급은 정해지지 않았습니다.')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('caste-slot')).toHaveCount(0);
  await expect(page.getByText('그것은 당신이 고르는 것입니다.')).toBeVisible();
  await expect(page.getByText('신세계에서는 태어나기 전에 정해집니다.')).toBeVisible();
  const stampBtn = page.getByRole('button', { name: '입국 도장 받기' });
  await expect(stampBtn).toBeVisible();
  await page.waitForTimeout(3600);
  await expectFits(page);
  await shot(page, 'm08-caste-result');
  await stampBtn.click();

  await expect(page.getByTestId('stamp')).toHaveText('입국 승인');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/m09-stamp.png' });
  await expect(page.getByText('발표가 끝나면 재심사가 있습니다.', { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scene', 'city-castes');
  await expectFits(page);
  await shot(page, 'm10-lobby');

  await control.keyboard.press('ArrowRight'); // closed1
  await expect(page.getByText('심사가 마감되었습니다. 발표가 끝나면 재심사가 있습니다.')).toBeVisible();
  await expectFits(page);
  await shot(page, 'm11-closed');

  await control.keyboard.press('ArrowRight'); // round2
  await expect(page.getByText('다시 묻겠습니다. 버튼 하나로 평생 슬픔이 사라진다면, 누르시겠습니까?')).toBeVisible();
  await expectFits(page);
  await shot(page, 'm12-recheck');
  await page.getByRole('button', { name: '누르지 않는다' }).click();

  // 재심사에는 섬이 없고 바로 출국
  await expect(page.getByTestId('compare')).toHaveText('처음: 누른다 → 지금: 누르지 않는다');
  await expect(page.getByText('하나라도 망설이셨다면, 출국을 환영합니다.')).toBeVisible();
  await expect(page.getByText('시크릿쥬쥬 · 『멋진 신세계』 독서멘토링')).toBeVisible();
  await expectFits(page);
  await shot(page, 'm13-exit');

  // 가로로 돌려도 깨지지 않는다
  await page.setViewportSize({ width: 844, height: 390 });
  await expectFits(page);
  await shot(page, 'm14-exit-landscape');

  expect(errors).toEqual([]);
});

test('마감: 1라운드를 다 못 끝내면 남은 문항을 건너뛰고, 종료되면 모두 출국한다', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('#/?demo=1');
  await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: '심사 시작' }).click();
  await page.getByRole('button', { name: '예', exact: true }).click();
  await expect(page.getByText('심사 2/4')).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  await expectFits(page);
  await shot(page, 'm15-q2-landscape');
  await page.setViewportSize({ width: 360, height: 640 });
  await expectFits(page);
  await shot(page, 'm16-q2-small');

  await page.keyboard.press('ArrowRight'); // closed1
  await expect(page.getByText('심사가 마감되었습니다. 발표가 끝나면 재심사가 있습니다.')).toBeVisible();
  await page.keyboard.press('ArrowRight'); // round2
  await expect(page.getByText('다시 묻겠습니다.', { exact: false })).toBeVisible();
  await page.keyboard.press('ArrowRight'); // ended
  await expect(page.getByText('하나라도 망설이셨다면, 출국을 환영합니다.')).toBeVisible();
  await expect(page.getByTestId('compare')).toHaveCount(0); // Q4 답이 둘 다 있어야 비교를 보여 준다
  expect(errors).toEqual([]);
});

test('Firebase 설정이 없으면 죽지 않고 데모 안내를 보여 준다', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('#/');
  await expect(page.getByText('데모 모드로 실행하려면 주소 끝에 ?demo=1')).toBeVisible();
  await shot(page, 'm17-noconfig');
  expect(errors).toEqual([]);
});

test('미디어 대체: 영상이 없으면 jpg, jpg 도 없으면 단색', async ({ page }) => {
  await page.route('**/media/city-castes.mp4', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('#/?demo=1');
  await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
  await expect(page.locator('.backdrop')).toHaveAttribute('data-layer', 'image');
  await expect(page.locator('.backdrop video')).toHaveCount(0);
  await shot(page, 'm18-fallback-jpg');

  await page.route('**/media/city-castes.jpg', (r) => r.fulfill({ status: 404, body: '' }));
  await page.reload();
  await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
  await expect(page.locator('.backdrop')).toHaveAttribute('data-layer', 'solid');
  await expect(page.locator('.backdrop img')).toHaveCount(0);
  await shot(page, 'm19-fallback-solid');
});

test('prefers-reduced-motion 이면 영상 대신 정지 이미지를 쓴다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('#/?demo=1');
  await expect(page.getByText('세계국가에 오신 것을 환영합니다')).toBeVisible();
  await expect(page.locator('.backdrop video')).toHaveCount(0);
  await expect(page.locator('.backdrop img')).toHaveCount(1);
});
