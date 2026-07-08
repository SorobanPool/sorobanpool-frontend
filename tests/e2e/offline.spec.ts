import { expect, test } from '@playwright/test';

/** A trader on patchy data: the shell still opens offline and says so; the last seen pages come from the cache. */
test('the app shell opens offline and shows an offline banner', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload(); // now controlled by the service worker, and the page is cached
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'You are offline' })).toBeVisible();

  await page.goto('/never-visited-before');
  await expect(page.getByRole('heading', { name: /offline/i })).toBeVisible(); // unknown page falls back to the offline screen
  await context.setOffline(false);
});

test('the service worker never caches credentials or money-moving endpoints', async ({ request }) => {
  const sw = await (await request.get('/sw.js')).text();
  const cacheable = /CACHEABLE_API\s*=\s*(\/.*\/);/.exec(sw)![1]!;
  const re = new RegExp(cacheable.slice(1, -1));
  for (const p of ['/v1/pools/7', '/v1/p/abc', '/v1/offers']) expect(re.test(p), p).toBe(true);
  for (const p of ['/v1/auth/otp/verify', '/v1/me', '/v1/wallets', '/v1/tx/submit', '/v1/uploads/sign', '/v1/evidence/x/url', '/v1/admin/audit', '/v1/bonds/me']) expect(re.test(p), p).toBe(false);
});
