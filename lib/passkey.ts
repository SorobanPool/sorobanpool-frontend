import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useSyncExternalStore } from 'react';
import { api } from './api';

export interface PasskeyInfo {
  id: string;
  createdAt: string;
}

export interface PasskeySession {
  accessToken: string;
  refreshToken: string;
  user: { walletAddress: string | null };
}

export const passkeysSupported = (): boolean => {
  try {
    return typeof window !== 'undefined' && browserSupportsWebAuthn();
  } catch {
    return false;
  }
};

/** Adds a passkey to the signed-in account (the person must already be signed in by SMS code). Returns its id. */
export async function registerPasskey(): Promise<string> {
  const { challengeId, options } = await api<{ challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('/auth/passkey/register/options', { body: {} });
  const response = await startRegistration({ optionsJSON: options });
  const r = await api<{ passkeyId: string }>('/auth/passkey/register/verify', { body: { challengeId, response } });
  return r.passkeyId;
}

/**
 * Creates the person's wallet: a new passkey on this phone, then a smart-wallet contract it controls (deployed and
 * paid for by SorobanPool; contracts ADR 0006). There is no secret to write down: the passkey is the key, and a
 * synced passkey keeps working on a new phone.
 */
export async function createPasskeyWallet(): Promise<string> {
  const passkeyId = await registerPasskey();
  const { walletAddress } = await api<{ walletAddress: string }>('/wallets/passkey', { body: { passkeyId } });
  const { adoptPasskeyWallet } = await import('./wallet');
  await adoptPasskeyWallet(walletAddress);
  return walletAddress;
}

/** Signs in with a passkey the device offers; no phone number or SMS needed. */
export async function signInWithPasskey(): Promise<PasskeySession> {
  const { challengeId, options } = await api<{ challengeId: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>('/auth/passkey/login/options', { body: {}, auth: false });
  const response = await startAuthentication({ optionsJSON: options });
  return api<PasskeySession>('/auth/passkey/login/verify', { body: { challengeId, response }, auth: false });
}

/** True when the person closed or cancelled the system passkey prompt (not an error worth showing). */
export const passkeyCancelled = (e: unknown): boolean => (e as { name?: string })?.name === 'NotAllowedError' || (e as { name?: string })?.name === 'AbortError';

/**
 * Whether to offer passkeys. False on the server and during hydration, then true after mount where supported:
 * rendering on browser capability directly would make the server and client markup differ.
 */
export function usePasskeySupport(): boolean {
  return useSyncExternalStore(() => () => {}, passkeysSupported, () => false);
}

export const listPasskeys = (): Promise<PasskeyInfo[]> => api<PasskeyInfo[]>('/auth/passkey');
export const removePasskey = (id: string): Promise<void> => api(`/auth/passkey/${encodeURIComponent(id)}`, { method: 'DELETE' });
