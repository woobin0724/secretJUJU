import { expect, type Page } from '@playwright/test';

/** 콘솔 에러와 처리되지 않은 예외를 모은다. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** 스크롤 없이 한 화면에 들어오는지, 글자가 패널 밖으로 넘치지 않는지 확인한다. */
export async function expectFits(page: Page) {
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    const panel = document.querySelector('.panel, .screen');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let outside = 0;
    panel?.querySelectorAll('h1, p, span, button, strong').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) outside += 1;
    });
    return {
      docScroll: d.scrollHeight > vh + 1 || d.scrollWidth > vw + 1,
      panelScroll: panel ? panel.scrollHeight > panel.clientHeight + 1 || panel.scrollWidth > panel.clientWidth + 1 : false,
      outside,
    };
  });
  expect(m, '화면 넘침').toEqual({ docScroll: false, panelScroll: false, outside: 0 });
}

export async function shot(page: Page, name: string) {
  await page.waitForTimeout(700); // 페이드가 끝난 뒤 찍는다
  await page.screenshot({ path: `qa/${name}.png` });
}
