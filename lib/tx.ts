import { api } from './api';
import { deployment } from './deployment';
import { assertSafeAuth } from './verify';
import { confirmWithDevice, loadWallet, signAuthEntries, type DeviceCheck } from './wallet';

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
  /** The most this action may send to SorobanPool contracts (stroops), when the screen already showed it. */
  maxTransfer?: bigint,
): Promise<TxOutcome> {
  const prepared = await prepare();
  const wallet = await loadWallet();
  if (!wallet) throw new Error('NO_WALLET');
  // Never sign what the backend sent without checking it is exactly the action the user asked for.
  assertSafeAuth(prepared.authEntries, { user: wallet.publicKey, contract: prepared.contract, fn: prepared.fn, maxTransfer }, deployment());
  const check: DeviceCheck = await confirmWithDevice();
  if (check === 'denied') throw new UserDeclined();
  if (check === 'unavailable' && !(await explicitConfirm())) throw new UserDeclined();
  const signed = await signAuthEntries(prepared.authEntries, prepared.validUntilLedger, NETWORK_PASSPHRASE);
  const r = await api<{ hash: string; fn: string }>('/tx/submit', { body: { txXdr: prepared.txXdr, signedAuthEntries: signed, idempotencyKey: idempotencyKey() } });
  return { hash: r.hash, fn: r.fn };
}
