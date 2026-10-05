import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ADMIN_PHONE, API, act, addVirtualAuthenticator, Client, makeActor, setArbiter, throttle, uploadFile, waitFor } from './helpers';
import { onboardViaUi } from './ui';

/**
 * M4: a supplier applies, activates and publishes an offer through the UI; a trader joins and reports a problem through
 * the UI; an arbiter decides it through the UI. Each step is confirmed against the chain/API.
 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

test.describe.serial('supplier portal and disputes', () => {
  test.setTimeout(20 * 60_000);
  const run = String(Date.now()).slice(-6);
  const title = `Honeywell Beans ${run}`;
  const phones = { supplier: `+23480361${run.slice(-5)}`, trader: `+23480362${run.slice(-5)}`, arbiter: '+2348000000002' };
  let ctx: Record<'supplier' | 'trader' | 'arbiter', BrowserContext>, page: Record<'supplier' | 'trader' | 'arbiter', Page>;
  let admin: Client, organizer: Awaited<ReturnType<typeof makeActor>>;
  let supplierId = '', offerId = '', poolId = '', slug = '';
  const pool = async () => (await fetch(`${API}/p/${slug}`)).json() as Promise<{ id: string; state: string; totalUnits: number }>;

  test.beforeAll(async ({ browser }) => {
    ctx = {} as typeof ctx; page = {} as typeof page;
    for (const k of ['supplier', 'trader', 'arbiter'] as const) {
      ctx[k] = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
      page[k] = await ctx[k].newPage();
      await addVirtualAuthenticator(ctx[k], page[k]);
      await throttle(page[k], 'fast3g');
    }
  });
  test.afterAll(async () => { for (const c of Object.values(ctx ?? {})) await c.close(); });

  test('supplier applies, activates on-chain, is approved, and publishes an offer through the UI', async () => {
    admin = await new Client(ADMIN_PHONE).login();
    const p = page.supplier;
    await onboardViaUi(p, phones.supplier, 'Tunde Ade');
    await p.goto('/supplier');
    await p.getByLabel('Business name').fill('Tunde Foods Ltd');
    await p.getByLabel('CAC registration number').fill('RC1234567');
    await p.getByLabel('Business address').fill('12 Market Road, Wuse');
    await p.getByLabel('LGA', { exact: true }).fill('Abuja Municipal');
    await p.getByLabel(/What you sell/).fill('beans, rice');
    await p.getByRole('button', { name: 'Apply to sell' }).click();
    await expect(p.getByText(/being reviewed/)).toBeVisible({ timeout: 30_000 });

    // Registered on-chain first (the attestor can only verify a supplier that exists), then approved.
    await p.getByRole('button', { name: 'Activate my supplier account' }).click();
    await expect(p.getByRole('status').filter({ hasText: 'Your supplier account is active.' })).toBeVisible({ timeout: 90_000 });
    supplierId = (await (await new Client(phones.supplier).login()).call('/me')).id;
    await admin.call(`/admin/suppliers/${supplierId}/decision`, { approve: true });

    await p.reload();
    await p.getByRole('link', { name: 'New offer' }).click();
    await p.getByLabel('Product name').fill(title);
    await p.getByLabel('Brand').fill('Honeywell');
    await p.getByLabel(/^Unit/).fill('50kg bag');
    await p.getByLabel('Description').fill('Brown beans, sorted and cleaned');
    await p.locator('#min-0').fill('50');
    await p.locator('#ngn-0').fill('1500');
    await p.locator('#min-1').fill('100');
    await p.locator('#ngn-1').fill('1400');
    await expect(p.getByTestId('usd-0')).toContainText('About 0.99'); // live USDC preview at today's rate
    for (let i = 1; i <= 2; i++) {
      await p.locator('input[type=file]').setInputFiles({ name: `beans${i}.png`, mimeType: 'image/png', buffer: PNG });
      await expect(p.getByText(`Photos (at least 2) (${i})`)).toBeVisible({ timeout: 60_000 });
    }
    await p.getByRole('button', { name: 'Publish offer' }).click();
    await expect(p.getByRole('status').filter({ hasText: 'Your offer is live.' })).toBeVisible({ timeout: 60_000 });
    const offers = (await (await fetch(`${API}/offers`)).json()) as { id: string; title: string; images: string[] }[];
    const mine = offers.find((o) => o.title === title)!;
    offerId = mine.id;
    expect(mine.images).toHaveLength(2);
    expect((await fetch(`${API}/images/${mine.images[0]}`)).headers.get('content-type')).toBe('image/webp'); // photos are actually served
  });

  test('an organizer opens the pool; a trader joins through the UI; the pool fills', async () => {
    organizer = await makeActor(`+23480363${run.slice(-5)}`, 'Organizer');
    const me = await organizer.c.call('/me');
    await admin.call(`/admin/users/${me.id}/roles`, { role: 'ORGANIZER' });
    await admin.call(`/admin/users/${me.id}/attest`, { role: 'Organizer', level: 1 });
    const prep = await act(organizer.c, organizer.kp, '/pools/prepare', {
      offerId, fillDeadline: new Date(Date.now() + 3600_000).toISOString(), hub: { address: 'Wuse Market Gate B', contact: '08031234567' }, pickupWindow: { from: 'Mon 9am', to: 'Mon 5pm' }, organizerFeeBp: 0, clusterOnly: false,
    });
    slug = prep.prepared.shareSlug;
    await waitFor(async () => typeof (await pool()).id === 'string', 'pool indexed', 90_000);
    poolId = (await pool()).id;

    await onboardViaUi(page.trader, phones.trader, 'Iya Bisi');
    await page.trader.goto(`/pools/${poolId}`);
    await page.trader.getByLabel('How many units?').fill('20');
    await page.trader.getByRole('button', { name: 'Pay now' }).click();
    await expect(page.trader.getByText('You joined with 20 units')).toBeVisible({ timeout: 120_000 });

    for (let i = 0; i < 2; i++) {
      const t = await makeActor(`+23480364${run.slice(-4)}${i}`, 'Trader');
      await act(t.c, t.kp, `/pools/${poolId}/commit/prepare`, { units: 20 });
    }
    await waitFor(async () => (await pool()).totalUnits === 60, '60 units indexed', 90_000);
    await act(organizer.c, organizer.kp, `/pools/${poolId}/close-early/prepare`, {}); // MOQ (50) reached: no need to wait for the deadline
    await waitFor(async () => (await pool()).state === 'Filled', 'Filled', 90_000);
  });

  test('the supplier accepts and dispatches from the dashboard; goods are delivered', async () => {
    const p = page.supplier;
    await p.goto('/supplier');
    await expect(p.getByTestId('supplier-pool').filter({ hasText: title })).toBeVisible({ timeout: 60_000 });
    await expect(p.getByText(/You will be paid about ₦/)).toBeVisible();
    await p.getByRole('button', { name: 'Accept order' }).click();
    await expect(p.getByRole('button', { name: 'Mark as dispatched' })).toBeVisible({ timeout: 120_000 });
    await p.getByRole('button', { name: 'Mark as dispatched' }).click();
    await waitFor(async () => (await pool()).state === 'Dispatched', 'Dispatched', 90_000);

    const ev = await uploadFile(organizer.c, 'DELIVERY', poolId, PNG);
    await act(organizer.c, organizer.kp, `/pools/${poolId}/delivery/prepare`, { receivedUnits: 60, evidenceIds: [ev] });
    await waitFor(async () => (await pool()).state === 'Delivered', 'Delivered', 90_000);
  });

  test('the trader reports a problem and the arbiter decides it, both through the UI', async () => {
    const t = page.trader;
    await t.goto(`/pools/${poolId}`);
    await t.getByRole('button', { name: 'Report a problem' }).click();
    await t.getByLabel('How many units are affected?').fill('2');
    await t.locator('input[type=file]').setInputFiles({ name: 'damage.png', mimeType: 'image/png', buffer: PNG });
    await expect(t.getByText('Photos (at least 1) (1)')).toBeVisible({ timeout: 60_000 });
    await t.getByRole('button', { name: 'Send report' }).click();
    await expect(t.getByRole('status').filter({ hasText: 'Your report was sent.' })).toBeVisible({ timeout: 120_000 });

    // The arbiter signs in, is enabled on-chain by the admin, and decides.
    const a = page.arbiter;
    await onboardViaUi(a, phones.arbiter, 'Arbiter One');
    const arbWallet = (await (await new Client(phones.arbiter).login()).call('/me')).walletAddress as string;
    await setArbiter(arbWallet);
    await a.goto('/arbiter');
    const item = a.getByRole('link', { name: /#\d+/ }).first();
    await expect(item).toBeVisible({ timeout: 90_000 });
    await item.click();
    await expect(a.getByTestId('payout-preview')).toContainText('Supplier gets');
    await a.getByRole('radio', { name: 'Refund some units' }).check();
    await a.getByLabel('Units to refund').fill('1');
    await expect(a.getByTestId('payout-preview')).toContainText('Buyer gets');
    await a.getByLabel(/Your reasoning/).fill('Photo shows damaged bags; refund one unit.');
    await a.getByRole('button', { name: 'Record decision' }).click();
    await expect(a.getByRole('status').filter({ hasText: 'Decision recorded.' })).toBeVisible({ timeout: 120_000 });

    const tc = await new Client(phones.trader).login();
    await waitFor(async () => ((await tc.call('/disputes?mine=true')) as { state: string }[]).some((d) => d.state === 'RESOLVED'), 'the dispute to show RESOLVED', 120_000);
  });
});
