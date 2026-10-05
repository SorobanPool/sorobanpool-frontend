import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { API, act, addVirtualAuthenticator, Client, makeActor, throttle, usdcBalance, waitFor } from './helpers';
import { onboardViaUi } from './ui';

/** M5: admin console (risk, supplier approval, offer takedown, user roles) and paying with the mock naira anchor. */
test.describe.serial('admin console and naira payment', () => {
  test.setTimeout(20 * 60_000);
  const run = String(Date.now()).slice(-6);
  const ADMIN_UI = '+2348000000004';
  const ADMIN_API = '+2348000000005';
  const titles = { takedown: `Takedown Garri ${run}`, naira: `Naira Rice ${run}` };
  let ctx: Record<'admin' | 'trader', BrowserContext>, page: Record<'admin' | 'trader', Page>;
  let adminApi: Client, supplier: Awaited<ReturnType<typeof makeActor>>, supplierId = '', traderApi: Client;
  const offers: Record<string, string> = {};
  let poolId = '';

  const offerBody = (title: string, category: string) => ({
    title, brand: 'Test', branded: true, description: 'Good goods', unitLabel: '50kg bag', category, perishable: false, images: ['a', 'b'],
    tiersNgn: [{ minUnits: 50, priceNgn: '1500' }, { minUnits: 100, priceNgn: '1400' }], moq: 50, maxUnits: 200, maxPerMember: 60, leadTimeHours: 72,
    deliveryAreas: [{ state: 'FCT' }], validUntil: new Date(Date.now() + 5 * 86400_000).toISOString(),
  });

  test.beforeAll(async ({ browser }) => {
    ctx = {} as typeof ctx; page = {} as typeof page;
    for (const k of ['admin', 'trader'] as const) {
      ctx[k] = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
      page[k] = await ctx[k].newPage();
      await addVirtualAuthenticator(ctx[k], page[k]);
      await throttle(page[k], 'fast3g');
    }
  });
  test.afterAll(async () => { for (const c of Object.values(ctx ?? {})) await c.close(); });

  test('the admin sees the risk overview and approves a supplier through the UI', async () => {
    adminApi = await new Client(ADMIN_API).login();
    await onboardViaUi(page.admin, ADMIN_UI, 'Ops Admin');
    await page.admin.goto('/admin');
    await expect(page.admin.getByRole('heading', { name: 'Admin console' })).toBeVisible();
    await expect(page.admin.getByText('Delivered value (GMV)')).toBeVisible({ timeout: 30_000 });
    await expect(page.admin.getByText('Failure rate (7 days)')).toBeVisible();

    supplier = await makeActor(`+23480351${run.slice(-5)}`, 'Supplier'); // registered on-chain, as the activation button does
    await supplier.c.call('/suppliers/apply', { businessName: `Test Foods ${run}`, cacNumber: 'RC7654321', address: '3 Test Road', state: 'FCT', lga: 'Bwari', categories: ['rice', 'garri'], deliveryAreas: [{ state: 'FCT' }] });
    supplierId = (await supplier.c.call('/me')).id;

    await page.admin.getByRole('link', { name: 'Suppliers' }).click();
    const card = page.admin.getByTestId('application').filter({ hasText: `Test Foods ${run}` });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByRole('button', { name: 'Approve' }).click();
    await expect(page.admin.getByRole('status').filter({ hasText: 'Decision saved.' })).toBeVisible({ timeout: 90_000 });
    expect((await supplier.c.call('/suppliers/me')).kybStatus).toBe('APPROVED');
  });

  test('the admin takes an offer down through the UI; it disappears from the public list', async () => {
    await supplier.c.login();
    for (const [key, title, category] of [['takedown', titles.takedown, 'garri'], ['naira', titles.naira, 'rice']] as const) {
      const o = await supplier.c.call('/offers', offerBody(title, category));
      await supplier.c.call(`/offers/${o.id}/publish`, {});
      offers[key] = o.id;
    }
    expect(((await (await fetch(`${API}/offers`)).json()) as { title: string }[]).some((o) => o.title === titles.takedown)).toBe(true);
    await page.admin.goto('/admin/offers');
    const row = page.admin.getByTestId('offer-row').filter({ hasText: titles.takedown });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: 'Take down' }).click();
    await expect(row.getByText(/Taken down/)).toBeVisible({ timeout: 30_000 });
    expect(((await (await fetch(`${API}/offers`)).json()) as { title: string }[]).some((o) => o.title === titles.takedown)).toBe(false);
    expect(((await (await fetch(`${API}/offers`)).json()) as { title: string }[]).some((o) => o.title === titles.naira)).toBe(true); // others unaffected
  });

  test('a trader pays with a naira bank transfer (mock anchor) and the dollars arrive before the payment', async () => {
    const organizer = await makeActor(`+23480352${run.slice(-5)}`, 'Organizer');
    const me = await organizer.c.call('/me');
    await adminApi.call(`/admin/users/${me.id}/roles`, { role: 'ORGANIZER' });
    await adminApi.call(`/admin/users/${me.id}/attest`, { role: 'Organizer', level: 1 });
    const prep = await act(organizer.c, organizer.kp, '/pools/prepare', { offerId: offers.naira, fillDeadline: new Date(Date.now() + 3600_000).toISOString(), hub: { address: 'Gate C', contact: '08031234567' }, pickupWindow: { from: 'Mon', to: 'Tue' }, organizerFeeBp: 0, clusterOnly: false });
    await waitFor(async () => (await (await fetch(`${API}/p/${prep.prepared.shareSlug}`)).json()).id !== undefined, 'pool indexed', 90_000);
    poolId = (await (await fetch(`${API}/p/${prep.prepared.shareSlug}`)).json()).id;

    const phone = `+23480353${run.slice(-5)}`;
    await onboardViaUi(page.trader, phone, 'Iya Ngozi');
    traderApi = await new Client(phone).login();
    const wallet = (await traderApi.call('/me')).walletAddress as string;
    await page.trader.goto(`/pools/${poolId}`);
    await page.trader.getByLabel('How many units?').fill('20');
    await page.trader.getByRole('radio', { name: 'Naira bank transfer' }).check();
    await expect(page.trader.getByRole('button', { name: 'Pay now' })).toBeDisabled(); // cannot pay until the naira has arrived
    await page.trader.getByRole('button', { name: 'Get bank details' }).click();
    await expect(page.trader.getByText(/Send ₦[\d,]+ to this account/)).toBeVisible({ timeout: 30_000 });
    const ref = (await page.trader.locator('dd.font-mono').textContent())!;
    expect(ref).toMatch(/^mock_/);

    const before = await usdcBalance(wallet);
    await page.trader.getByRole('button', { name: /pretend the bank transfer arrived/ }).click();
    await expect(page.trader.getByText(/Transfer received/)).toBeVisible({ timeout: 120_000 });
    const t = await traderApi.call(`/anchor/transfers/${ref}`);
    expect(t.status).toBe('COMPLETED');
    const credited = BigInt(Math.round(Number(t.amountUsdc) * 1e7));
    await waitFor(async () => (await usdcBalance(wallet)) - before === credited, `the naira deposit to land on-chain (${credited} stroops)`, 60_000, 2000);

    await expect(page.trader.getByRole('button', { name: 'Pay now' })).toBeEnabled();
    await page.trader.getByRole('button', { name: 'Pay now' }).click();
    await expect(page.trader.getByText('You joined with 20 units')).toBeVisible({ timeout: 120_000 });
  });

  test('the admin finds a user and grants a role through the UI', async () => {
    const needle = `Iya Ngozi`;
    await page.admin.goto('/admin/users');
    await page.admin.getByLabel('Search by phone or name').fill(needle);
    const row = page.admin.getByTestId('user-row').filter({ hasText: needle });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: 'Make ORGANIZER' }).click();
    await expect(page.admin.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible({ timeout: 30_000 });
    const roles = ((await traderApi.call('/me')).roles as string[]);
    expect(roles).toContain('ORGANIZER');
  });
});
