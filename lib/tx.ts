import { api } from './api';
import { confirmWithDevice, signAuthEntries, type DeviceCheck } from './wallet';

export interface Prepared {
  txXdr: string;
  authEntries: string[];
  validUntilLedger: number;
  contract: string;
  fn: string;
  [extra: string]: unknown;
}

export interface TxOutcome {
  hash: string;
  fn: string;
}

export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';

export class UserDeclined extends Error {
  constructor() {
    super('USER_DECLINED');
  }
}

const idempotencyKey = (): string => `${Date.now().toString(36)}-${crypto.randomUUID()}`;

/**
 * prepare -> confirm on the device -> sign authorization entries -> submit. The user never pays a fee and the
 * key never leaves the device. `explicitConfirm` is called only when the device has no biometric gate.
 */
export async function runAction(
  prepare: () => Promise<Prepared>,
  explicitConfirm: () => Promise<boolean>,
): Promise<TxOutcome> {
  const prepared = await prepare();
  const check: DeviceCheck = await confirmWithDevice();
  if (check === 'denied') throw new UserDeclined();
  if (check === 'unavailable' && !(await explicitConfirm())) throw new UserDeclined();
  const signed = await signAuthEntries(prepared.authEntries, prepared.validUntilLedger, NETWORK_PASSPHRASE);
  const r = await api<{ hash: string; fn: string }>('/tx/submit', { body: { txXdr: prepared.txXdr, signedAuthEntries: signed, idempotencyKey: idempotencyKey() } });
  return { hash: r.hash, fn: r.fn };
}
