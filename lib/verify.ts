import { Address, scValToNative, xdr } from '@stellar/stellar-sdk';

/**
 * The backend builds the transaction, so the device must not trust it blindly: before signing, the whole
 * authorization tree is checked. A compromised backend could otherwise add a token transfer to its own address
 * and the fingerprint prompt would not show it.
 *
 * Allowed: the one call the user asked for, plus USDC `transfer`s FROM the user TO a SorobanPool contract
 * (escrow, bond or dispute deposit), optionally capped. Anything else is refused.
 */
export class UnsafeTransaction extends Error {
  constructor(public readonly reason: string) {
    super(`UNSAFE_TRANSACTION: ${reason}`);
  }
}

export interface Deployment {
  usdc: string;
  contracts: Record<string, string>; // logical name -> contract id
}

export interface AuthRules {
  user: string;
  /** Logical contract name of the call the user asked for, e.g. "group_buy". */
  contract: string;
  fn: string;
  /** Total the user may send to SorobanPool contracts in this action (stroops). Omit when it is not known up front. */
  maxTransfer?: bigint;
}

const addr = (sc: xdr.ScAddress): string => Address.fromScAddress(sc).toString();

export function assertSafeAuth(entries: string[], rules: AuthRules, deployment: Deployment): void {
  const root = deployment.contracts[rules.contract];
  if (!root) throw new UnsafeTransaction(`unknown contract ${rules.contract}`);
  const recipients = new Set(['group_buy', 'disputes', 'supplier_bond'].map((n) => deployment.contracts[n]).filter((x): x is string => !!x));
  let mine = 0;
  let sent = 0n;

  const walk = (inv: xdr.SorobanAuthorizedInvocation, depth: number): void => {
    const fn = inv.function;
    if (fn.type !== 'sorobanAuthorizedFunctionTypeContractFn') throw new UnsafeTransaction('only contract calls may be authorised');
    const call = fn.contractFn;
    const contract = addr(call.contractAddress);
    const name = String(call.functionName);
    if (depth === 0) {
      if (contract !== root || name !== rules.fn) throw new UnsafeTransaction(`expected ${rules.contract}.${rules.fn}`);
    } else if (contract === deployment.usdc && name === 'transfer') {
      const [from, to, amount] = call.args.map((a) => scValToNative(a) as unknown);
      if (from !== rules.user) throw new UnsafeTransaction('a transfer would move money that is not yours');
      if (typeof to !== 'string' || !recipients.has(to)) throw new UnsafeTransaction('a transfer would send money outside SorobanPool');
      sent += BigInt(amount as bigint);
    } else {
      throw new UnsafeTransaction(`unexpected nested call ${contract}.${name}`);
    }
    for (const sub of inv.subInvocations) walk(sub, depth + 1);
  };

  for (const e of entries) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(e, 'base64');
    const c = entry.credentials;
    const who = c.type === 'sorobanCredentialsAddress' ? addr(c.address.address) : c.type === 'sorobanCredentialsAddressV2' ? addr(c.addressV2.address) : null;
    if (who === null) throw new UnsafeTransaction('unsupported credentials');
    if (who !== rules.user) continue; // not ours: we will not sign it
    mine++;
    walk(entry.rootInvocation, 0);
  }
  if (mine === 0) throw new UnsafeTransaction('nothing in this request needs your approval');
  if (rules.maxTransfer !== undefined && sent > rules.maxTransfer) throw new UnsafeTransaction('the payment is larger than the amount shown');
}
