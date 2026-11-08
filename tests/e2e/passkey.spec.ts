import { expect, test } from '@playwright/test';
import { addVirtualAuthenticator } from './helpers';
import { onboardViaUi } from './ui';

/**
 * Real browser, real WebAuthn (Chrome's virtual platform authenticator), real backend and testnet. The passkey made
 * during onboarding controls the wallet; after signing out (which forgets the wallet on this device), signing in
 * with the same passkey lands straight in the app with the wallet ready: nothing to restore, no SMS code.
 */
test('a trader signs out and back in with their passkey, and the wallet comes back with it', async ({ page, context }) => {
  test.setTimeout(8 * 60_000);
  await addVirtualAuthenticator(context, page);
  const phone = `0803${Math.floor(1000000 + Math.random() * 8999999)}`;
  await onboardViaUi(page, phone, 'Passkey Trader');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(page).not.toHaveURL(/\/onboarding/);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText(/There is no secret to write down/)).toBeVisible(); // signed in, wallet adopted again

  // The passkey just used to sign in is now listed, and can be removed from this same screen.
  await expect(page.getByText(/Passkey added/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText(/Passkey added/)).not.toBeVisible();
});

