import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ADMIN_PHONE, API, act, addVirtualAuthenticator, Client, makeActor, throttle, usdcBalance, waitFor } from './helpers';
import { localDateTime, onboardViaUi } from './ui';

/**
 * Flows 5.3 (organizer creates a pool), 5.4 (traders join and pay across a price break), 5.5 (the pool fills) and
 * 5.7 (short delivery, pickups, early-release settlement, refund), on throttled mobile browsers against testnet.
 */
test.describe.serial('group-buy lifecycle', () => {
  test.setTimeout(20 * 60_000);
  const run = String(Date.now()).slice(-6);
  const title = `Mama Gold Rice ${run}`;
  const phones = { organizer: `+23480381${run.slice(-5)}`, trader: `+23480382${run.slice(-5)}`, supplier: `+23480383${run.slice(-5)}` };
  let orgCtx: BrowserContext, traderCtx: BrowserContext, org: Page, trader: Page;
  let admin: Client, supplier: Awaited<ReturnType<typeof makeActor>>;
  let offerId = '', slug = '', poolId = '';
  let traderApi: Client; // one login per phone: the OTP limiter (3 per 15 minutes) is real
  const apiTraders: Awaited<ReturnType<typeof makeActor>>[] = [];
  const pool = async () => (await fetch(`${API}/p/${slug}`)).json() as Promise<{ id: string; state: string; totalUnits: number; finalUnitPriceUsdc: string | null; receivedUnits: number | null; ngnPerUsd: number | null }>;

  test.beforeAll(async ({ browser }) => {
    orgCtx = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
    traderCtx = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
    org = await orgCtx.newPage();
    trader = await traderCtx.newPage();
    for (const [ctx, page] of [[orgCtx, org], [traderCtx, trader]] as const) {
      await addVirtualAuthenticator(ctx, page);
      await throttle(page, 'fast3g');
    }
  });
  test.afterAll(async () => { await orgCtx?.close(); await traderCtx?.close(); });

  test('supplier is verified and publishes an offer', async () => {
    admin = await new Client(ADMIN_PHONE).login();
    supplier = await makeActor(phones.supplier, 'Supplier');
    await supplier.c.call('/suppliers/apply', { businessName: 'Tunde Foods Ltd', cacNumber: 'RC1234567', address: '12 Market Rd', state: 'FCT', lga: 'Abuja Municipal', categories: ['rice'], deliveryAreas: [{ state: 'FCT' }] });
    const me = await supplier.c.call('/me');
    await admin.call(`/admin/suppliers/${me.id}/decision`, { approve: true });
    await supplier.c.login(); // fresh token after approval
    const offer = await supplier.c.call('/offers', {
      title, brand: 'Mama Gold', branded: true, description: 'Parboiled long grain rice', unitLabel: '50kg bag', category: 'rice', perishable: false, images: ['a.webp', 'b.webp'],
      tiersNgn: [{ minUnits: 50, priceNgn: '1500' }, { minUnits: 100, priceNgn: '1400' }, { minUnits: 150, priceNgn: '1300' }],
      moq: 50, maxUnits: 200, maxPerMember: 60, leadTimeHours: 72, deliveryAreas: [{ state: 'FCT' }], validUntil: new Date(Date.now() + 5 * 86400_000).toISOString(),
    });
    offerId = offer.id;
    await supplier.c.call(`/offers/${offerId}/publish`, {});
  });

  test('organizer onboards, gets approved, activates, and creates a pool through the wizard (5.3)', async () => {
    await onboardViaUi(org, phones.organizer, 'Alhaji Musa');
    const probe = await new Client(phones.organizer).login();
    const me = await probe.call('/me');
    await admin.call(`/admin/users/${me.id}/roles`, { role: 'ORGANIZER' });

    await org.goto('/organize');
    await expect(org.getByRole('heading', { name: 'Organize a group buy' })).toBeVisible();
    await org.getByRole('button', { name: 'Activate my organizer account' }).click();
    await expect(org.getByRole('status')).toContainText('Your organizer account is active.', { timeout: 90_000 });
    await admin.call(`/admin/users/${me.id}/attest`, { role: 'Organizer', level: 1 });

    await org.getByRole('link', { name: 'Create group buy' }).click();
    await org.getByRole('radio', { name: new RegExp(title) }).check();
    await org.getByRole('button', { name: 'Next' }).click();
    await org.getByLabel('Closes on').fill(localDateTime(400));
    await org.getByRole('button', { name: 'Next' }).click();
    await org.getByLabel('Pickup address').fill('Wuse Market Gate B');
    await org.getByLabel('Contact phone at the pickup place').fill('08031234567');
    await org.getByLabel('Pickup from').fill('Mon 9am');
    await org.getByLabel('Pickup until').fill('Mon 5pm');
    await org.getByRole('button', { name: 'Next' }).click();
    await org.getByLabel('Organizer fee (%)').fill('0.5');
    await org.getByRole('button', { name: 'Next' }).click();
    await expect(org.getByText('Wuse Market Gate B · 08031234567')).toBeVisible();
    await org.getByRole('button', { name: 'Create group buy' }).click();
    await expect(org.getByRole('status')).toContainText('Your group buy is live!', { timeout: 120_000 });
    const href = await org.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href', { timeout: 90_000 });
    slug = /\/p\/([0-9a-f]+)/.exec(decodeURIComponent(href!))![1]!;
    let last: unknown;
    await waitFor(async () => {
      last = await pool();
      return typeof (last as { id?: string }).id === 'string';
    }, `pool ${slug} to be readable (last response: ${JSON.stringify(last)})`, 60_000, 2000);
    poolId = (await pool()).id;
    expect(poolId, `slug=${slug} href=${href}`).toMatch(/^\d+$/);
  });

  test('the public WhatsApp page is server-rendered with link-preview tags and the trust message', async ({ request }) => {
    const res = await request.get(`/p/${slug}`);
    const html = await res.text();
    expect(res.status()).toBe(200);
    expect(html).toContain(title);
    expect(html).toContain('Your money is held safely');
    expect(html).toContain('Wuse Market Gate B');
    expect(html).toMatch(/property="og:image" content="[^"]*\/sharecard\.png"/);
    expect((await request.get(`${API}/pools/${poolId}/sharecard.png`)).headers()['content-type']).toBe('image/png');
  });

  test('a trader onboards and joins and pays (5.4)', async () => {
    await onboardViaUi(trader, phones.trader, 'Iya Bisi');
    await trader.goto(`/p/${slug}`);
    await expect(trader.getByTestId('trust-message')).toBeVisible();
    await trader.getByRole('link', { name: 'Join this group buy' }).click();
    await trader.getByLabel('How many units?').fill('20');

    traderApi = await new Client(phones.trader).login();
    const q = await traderApi.call(`/pools/${poolId}/quote?units=20`);
    await expect(trader.getByTestId('max-now')).toHaveText(`₦${q.amountNowNairaEstimate}`); // the screen matches the server quote
    await expect(trader.getByTestId('expected-refund')).toBeVisible();
    await trader.getByRole('button', { name: 'Pay now' }).click(); // the virtual authenticator approves
    await expect(trader.getByRole('status').filter({ hasText: 'You are in!' })).toBeVisible({ timeout: 120_000 });
    await expect(trader.getByText('You joined with 20 units')).toBeVisible({ timeout: 60_000 });
  });

  test('more traders cross the price break and the keeper fills the pool (5.5)', async () => {
    const units = [20, 20, 20, 25];
    for (let i = 0; i < units.length; i++) {
      const a = await makeActor(`+23480384${run.slice(-4)}${i}`, 'Trader');
      apiTraders.push(a);
      await act(a.c, a.kp, `/pools/${poolId}/commit/prepare`, { units: units[i] });
    }
    await waitFor(async () => (await pool()).totalUnits === 105, 'all 105 units indexed', 90_000);
    await waitFor(async () => (await pool()).state === 'Filled', 'the keeper to close the pool at its deadline', 900_000);
    const p = await pool();
    expect(p.finalUnitPriceUsdc).not.toBeNull();

    await trader.goto(`/pools/${poolId}`);
    await expect(trader.getByRole('listitem').filter({ hasText: 'Group is full' })).toHaveAttribute('aria-current', 'step', { timeout: 60_000 });
  });

  test('the supplier accepts and dispatches; the organizer confirms a short delivery with a photo (5.7)', async () => {
    await act(supplier.c, supplier.kp, `/pools/${poolId}/accept/prepare`, {});
    await act(supplier.c, supplier.kp, `/pools/${poolId}/dispatch/prepare`, {});
    await waitFor(async () => (await pool()).state === 'Dispatched', 'Dispatched indexed', 90_000);

    await org.goto('/organize');
    await expect(org.getByText(title)).toBeVisible({ timeout: 60_000 });
    await org.getByRole('link', { name: 'Confirm delivery' }).first().click();
    await org.getByLabel('Units received').fill('100');
    await expect(org.getByText('5 units short')).toBeVisible();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
    await org.locator('input[type=file]').setInputFiles({ name: 'goods.png', mimeType: 'image/png', buffer: png });
    await expect(org.getByText('Photos of the goods (1)')).toBeVisible({ timeout: 60_000 });
    await org.getByRole('button', { name: 'Confirm delivery' }).click();
    await expect(org.getByRole('status').filter({ hasText: 'Delivery confirmed.' })).toBeVisible({ timeout: 120_000 });
    await waitFor(async () => (await pool()).state === 'Delivered', 'Delivered indexed', 90_000);
    expect((await pool()).receivedUnits).toBe(100);
  });

  test('members collect, the keeper settles early, and the trader claims a refund that lands on-chain', async () => {
    // The keeper first shares the 5-unit shortfall; then the trader sees the goods are ready.
    await trader.goto(`/pools/${poolId}`);
    await expect(trader.getByRole('listitem').filter({ hasText: 'Arrived at pickup place' })).toHaveAttribute('aria-current', 'step', { timeout: 90_000 });
    await trader.getByRole('button', { name: "I've collected" }).click();
    await expect(trader.getByRole('status').filter({ hasText: 'Thanks! Collected.' })).toBeVisible({ timeout: 120_000 });

    const wallet = (await traderApi.call('/me')).walletAddress as string;
    const before = await usdcBalance(wallet);
    // 20 (UI) + 20 + 20 + 25 units confirmed = 85 of 105 >= 60%: early release.
    for (const a of apiTraders.slice(1)) await act(a.c, a.kp, `/pools/${poolId}/pickup/prepare`, {});
    await waitFor(async () => (await pool()).state === 'Settled', 'the keeper to settle', 180_000);

    const offer = await (await fetch(`${API}/offers/${offerId}`)).json() as { tiersUsdc: { minUnits: number; unitPrice: string }[] };
    const p1 = BigInt(offer.tiersUsdc[0]!.unitPrice);
    const p2 = BigInt(offer.tiersUsdc[1]!.unitPrice); // 105 units reach the 100-unit tier
    const alloc = (20 * 100) / 105 | 0; // the trader committed first: floor(20*100/105) units of the 100 delivered
    const expectedRefund = 20n * p1 - BigInt(alloc) * p2;

    await trader.goto(`/pools/${poolId}`);
    await expect(trader.getByRole('listitem').filter({ hasText: 'Done' })).toBeVisible({ timeout: 60_000 });
    // The keeper may already have pushed the refund; either way the money must arrive exactly once.
    await trader.getByRole('button', { name: 'Claim my refund' }).click();
    await expect(trader.getByRole('status').filter({ hasText: 'Refund received.' })).toBeVisible({ timeout: 120_000 });
    await waitFor(async () => (await usdcBalance(wallet)) - before === expectedRefund, `the refund of ${expectedRefund} stroops on-chain`, 30_000, 2000);
  });
});
