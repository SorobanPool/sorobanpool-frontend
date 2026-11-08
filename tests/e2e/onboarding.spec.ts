import { expect, test } from '@playwright/test';
import { addVirtualAuthenticator, Client, throttle } from './helpers';

/**
 * Flow 5.1: a trader onboards from a phone number to a funded, registered passkey wallet, on a throttled mobile
 * connection. The virtual authenticator stands in for the phone's fingerprint/face; every signature is a real
 * WebAuthn assertion that the wallet contract verifies on testnet.
 */
test('trader onboarding (5.1)', async ({ page, context }) => {
  test.setTimeout(240_000);
  await addVirtualAuthenticator(context, page);
  await throttle(page, 'fast3g');
  const phone = `+23480399${String(Date.now()).slice(-5)}`;

  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Your phone number').fill(phone);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByLabel('6-digit code')).toHaveValue(/^\d{6}$/); // dev server echoes the code
  await page.getByRole('button', { name: 'Verify' }).click();

  await page.getByLabel('Your name').fill('Iya Bisi');
  await page.getByLabel('Your market').fill('Wuse Market');
  await page.getByLabel('LGA').fill('Abuja Municipal');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Set up your wallet' })).toBeVisible();
  await page.getByRole('button', { name: 'Create my wallet' }).click();
  await expect(page.getByRole('heading', { name: /Get test money/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Add practice money' }).click();

  // Registration is signed with the passkey (virtual authenticator approves) and the sponsor pays the fee.
  // There is no backup step: nothing secret exists on the device.
  await expect(page.getByRole('status')).toContainText('You are all set', { timeout: 120_000 });
  await expect(page.getByTestId('backup-secret')).toHaveCount(0);

  // The backend sees a bound wallet and a profile with a market cluster.
  const token = await page.evaluate(async (p) => {
    const r1 = await fetch('http://localhost:3100/v1/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: p }) });
    const j = await r1.json();
    const r2 = await fetch('http://localhost:3100/v1/auth/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: p, code: j.devCode }) });
    return (await r2.json()).accessToken as string;
  }, phone);
  const c = new Client(phone);
  c.token = token;
  const me = await c.call('/me');
  expect(me.walletAddress).toMatch(/^C[A-Z2-7]{55}$/); // a passkey smart wallet, not a key in the browser
  expect(me.displayName).toBe('Iya Bisi');
  expect((await c.call('/me/profile')).cluster).toBe('wuse_market');

  // Settings explains there is nothing to back up.
  await page.goto('/settings');
  await expect(page.getByText(/There is no secret to write down/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show my backup' })).toHaveCount(0);

  // Switching to Pidgin changes the copy and persists.
  await page.getByRole('button', { name: 'Pidgin' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Buy together. Pay when goods reach.');
});
