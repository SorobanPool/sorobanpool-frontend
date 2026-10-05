import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { Client } from './helpers';

/** Real-browser axe scan (this one checks colour contrast, which jsdom cannot) on the main screens, in both languages. */
async function scan(page: import('@playwright/test').Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target).join(',')}`), label).toEqual([]);
}

/** Admin screens need an ADMIN session; a bootstrap admin phone per run avoids the OTP rate limit. */
test('admin screens have no WCAG 2.1 AA violations', async ({ page }) => {
  // Dev server admin phones are +2348000000006..09 (and 01,03,04,05 used elsewhere); rotate so reruns do not hit the OTP limiter.
  const c = new Client(`+234800000000${6 + (Math.floor(Date.now() / 900_000) % 4)}`);
  const r = await c.call('/auth/otp/request', { phone: c.phone });
  const v = await c.call('/auth/otp/verify', { phone: c.phone, code: r.devCode });
  // Only seed the token once: this script re-runs on every navigation, and re-writing an already-rotated token would
  // look like token theft to the server (it revokes the session) and silently bounce us to onboarding.
  await page.addInitScript((t) => { if (!localStorage.getItem('sp.refresh')) localStorage.setItem('sp.refresh', t); }, v.refreshToken as string);
  for (const path of ['/admin', '/admin/suppliers', '/admin/users', '/admin/offers', '/admin/disputes', '/admin/audit']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Admin console' })).toBeVisible();
    expect(new URL(page.url()).pathname, 'stayed signed in on the requested page').toBe(path);
    await page.waitForLoadState('networkidle');
    await scan(page, `admin ${path}`);
  }
});

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
    // Only seed the token once: this script re-runs on every navigation, and re-writing an already-rotated token would
  // look like token theft to the server (it revokes the session) and silently bounce us to onboarding.
  await page.addInitScript((t) => { if (!localStorage.getItem('sp.refresh')) localStorage.setItem('sp.refresh', t); }, v.refreshToken as string);
    for (const path of ['/', '/explore', '/organize', '/settings', '/supplier', '/supplier/offers/new', '/supplier/statement', '/arbiter']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(new URL(page.url()).pathname, `${locale}: stayed signed in on ${path}`).toBe(path);
      await scan(page, `${locale} ${path}`);
    }
  });
}
