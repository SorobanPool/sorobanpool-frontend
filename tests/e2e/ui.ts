import { expect, type Page } from '@playwright/test';

/** Phone -> OTP -> profile -> wallet -> test money -> backup, through the real UI. Returns the phone used. */
export async function onboardViaUi(page: Page, phone: string, name: string): Promise<void> {
  await page.goto('/onboarding');
  await page.getByLabel('Your phone number').fill(phone);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByLabel('6-digit code')).toHaveValue(/^\d{6}$/);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Your market').fill('Wuse Market');
  await page.getByLabel('LGA').fill('Abuja Municipal');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create my wallet' }).click();
  await page.getByRole('button', { name: 'Add practice money' }).click({ timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Keep a backup' })).toBeVisible({ timeout: 150_000 });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('status')).toContainText('You are all set');
}

/** datetime-local value (YYYY-MM-DDTHH:mm) for `secs` from now in the browser's local time. */
export function localDateTime(secs: number): string {
  const d = new Date(Date.now() + secs * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
