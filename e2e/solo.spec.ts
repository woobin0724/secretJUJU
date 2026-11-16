import { expect, test } from '@playwright/test';
import { expectFits, shot, watchErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('혼자 해보기: 매 문항 뒤 섬, 서버 호출 없음, 재심사·출국까지', async ({ page, baseURL }) => {
  const errors = watchErrors(page);
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) external.push(r.url());
  });
  page.on('websocket', (ws) => external.push(ws.url()));

  await page.goto('#/solo');
  await page.getByRole('button', { name: '심사 시작' }).click();

  const island = async (q: string, expected: string, pick: string) => {
    await expect(page.locator('.stage')).toHaveAttribute('data-step', `question:${q}`, { timeout: 15_000 });
    await page.getByRole('button', { name: pick, exact: true }).click();
    await expect(page.locator('.stage')).toHaveAttribute('data-step', `island:${q}`);
    await expect(page.getByTestId('island-text')).toHaveText(expected);
    await expect(page.getByRole('button')).toHaveCount(0);
    await page.waitForTimeout(5000);
    await expect(page.locator('.stage')).toHaveAttribute('data-step', `island:${q}`); // 아직 건너뛸 수 없다
  };

  await island('q1', '그럼 오늘 당신을 불행하게 한 일도 지키고 싶습니까?', '아니오');
  await expectFits(page);
  await shot(page, 's01-island-q1');
  await island('q2', '마지막으로 오래 고민해서 내린 결정은 무엇이었습니까?', '예');
  await island('q3', '남들과 다른 생각을 마지막으로 말해 본 건 언제입니까?', '아니오');
  await island('q4', '존은 불행해질 권리를 요구했고, 결국 무너졌습니다. 그래도 고르시겠습니까?', '누르지 않는다');
  await expectFits(page);

  await expect(page.getByText('당신의 계급은 정해지지 않았습니다.')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '입국 도장 받기' }).click();
  await expect(page.getByTestId('stamp')).toBeVisible();

  await expect(page.getByText('시간이 흘렀습니다. 같은 질문을 한 번 더 받겠습니다.')).toBeVisible({ timeout: 8000 });
  await expectFits(page);
  await shot(page, 's02-lobby');
  await page.getByRole('button', { name: '재심사 받기' }).click();

  await expect(page.getByText('다시 묻겠습니다.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '누른다', exact: true }).click();
  await expect(page.getByTestId('compare')).toHaveText('처음: 누르지 않는다 → 지금: 누른다');
  await expect(page.getByText('하나라도 망설이셨다면, 출국을 환영합니다.')).toBeVisible();
  await shot(page, 's03-exit');

  expect(external, '외부(서버) 요청').toEqual([]);
  expect(await page.evaluate(() => localStorage.length), 'localStorage 에도 쓰지 않는다').toBe(0);
  expect(errors).toEqual([]);
});
