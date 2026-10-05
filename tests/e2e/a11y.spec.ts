import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { Client } from './helpers';

/** Real-browser axe scan (this one checks colour contrast, which jsdom cannot) on the main screens, in both languages. */
async function scan(page: import('@playwright/test').Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target).join(',')}`), label).toEqual([]);
}

for (const locale of ['en', 'pcm'] as const) {
  test(`anonymous screens have no WCAG 2.1 AA violations (${locale})`, async ({ page, context }) => {
    await context.addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3101' }]);
    for (const path of ['/', '/onboarding', '/offline']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await scan(page, `${locale} ${path}`);
    }
  });

  test(`signed-in screens have no WCAG 2.1 AA violations (${locale})`, async ({ page, context }) => {
    await context.addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3101' }]);
    const c = new Client(`+23480370${String(Date.now()).slice(-5)}`);
    const r = await c.call('/auth/otp/request', { phone: c.phone });
    const v = await c.call('/auth/otp/verify', { phone: c.phone, code: r.devCode });
    await page.addInitScript((t) => localStorage.setItem('sp.refresh', t), v.refreshToken as string);
    for (const path of ['/', '/explore', '/organize', '/settings']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await scan(page, `${locale} ${path}`);
    }
  });
}
