import { expect, test } from '@playwright/test';
import { addVirtualAuthenticator } from './helpers';
import { onboardViaUi } from './ui';

/** Real browser, real WebAuthn (Chrome's virtual platform authenticator), real backend: add a passkey, sign out, sign in with it. */
test('a trader adds a passkey, signs out, and signs back in without an SMS code', async ({ page, context }) => {
  test.setTimeout(8 * 60_000);
  await addVirtualAuthenticator(context, page);
  const phone = `0803${Math.floor(1000000 + Math.random() * 8999999)}`;
  await onboardViaUi(page, phone, 'Passkey Trader');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Add a passkey on this phone' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Passkey added' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  // This device still holds the wallet bound to the account, so sign-in lands straight in the app.
  await expect(page).not.toHaveURL(/\/onboarding/);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a passkey on this phone' })).toBeVisible(); // signed in, not bounced to onboarding
});
