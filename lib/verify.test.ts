// @vitest-environment node
import { Address, Keypair, StrKey, xdr, nativeToScVal } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { assertSafeAuth, UnsafeTransaction, type Deployment } from './verify';

const id = (n: number) => StrKey.encodeContract(Buffer.alloc(32, n));
const dep: Deployment = { usdc: id(9), contracts: { group_buy: id(1), disputes: id(2), supplier_bond: id(3), registry: id(4), config: id(5) } };
const user = Keypair.random().publicKey();
const attacker = Keypair.random().publicKey();

const call = (contract: string, fn: string, args: xdr.ScVal[], subs: xdr.SorobanAuthorizedInvocation[] = []) =>
  new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(new xdr.InvokeContractArgs({ contractAddress: new Address(contract).toScAddress(), functionName: fn, args })),
    subInvocations: subs,
  });
const transfer = (from: string, to: string, amount: bigint) => call(dep.usdc, 'transfer', [new Address(from).toScVal(), new Address(to).toScVal(), nativeToScVal(amount, { type: 'i128' })]);
const entry = (who: string, root: xdr.SorobanAuthorizedInvocation, v2 = true) => {
  const creds = new xdr.SorobanAddressCredentials({ address: new Address(who).toScAddress(), nonce: 1n, signatureExpirationLedger: 0, signature: xdr.ScVal.scvVoid() });
  return new xdr.SorobanAuthorizationEntry({ credentials: v2 ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(creds) : xdr.SorobanCredentials.sorobanCredentialsAddress(creds), rootInvocation: root }).toXDR('base64');
};
const commit = (subs: xdr.SorobanAuthorizedInvocation[] = []) => call(dep.contracts.group_buy!, 'commit', [new Address(user).toScVal()], subs);
const rules = { user, contract: 'group_buy', fn: 'commit' };
const refuses = (entries: string[], r = rules) => { try { assertSafeAuth(entries, r, dep); } catch (e) { return e instanceof UnsafeTransaction ? e.reason : `other: ${(e as Error).message}`; } return 'accepted'; };

describe('assertSafeAuth', () => {
  it('accepts the requested call with an escrow payment, for plain and V2 credentials', () => {
    for (const v2 of [true, false]) expect(refuses([entry(user, commit([transfer(user, dep.contracts.group_buy!, 100n)]), v2)])).toBe('accepted');
  });
  it('accepts a call with no payment (register, pickup, refund)', () => {
    expect(refuses([entry(user, call(dep.contracts.registry!, 'register', [new Address(user).toScVal()]))], { user, contract: 'registry', fn: 'register' })).toBe('accepted');
  });
  it('refuses a payment to anyone outside SorobanPool: the backend cannot redirect funds', () => {
    expect(refuses([entry(user, commit([transfer(user, attacker, 100n)]))])).toMatch(/outside SorobanPool/);
  });
  it('refuses moving someone else\'s money and hidden extra transfers', () => {
    expect(refuses([entry(user, commit([transfer(attacker, dep.contracts.group_buy!, 1n)]))])).toMatch(/not yours/);
    expect(refuses([entry(user, commit([transfer(user, dep.contracts.group_buy!, 1n), transfer(user, attacker, 5n)]))])).toMatch(/outside SorobanPool/);
  });
  it('refuses a different function or contract than the one the user asked for', () => {
    expect(refuses([entry(user, call(dep.contracts.group_buy!, 'cancel_pool', []))])).toMatch(/expected group_buy.commit/);
    expect(refuses([entry(user, call(dep.contracts.disputes!, 'commit', []))])).toMatch(/expected group_buy.commit/);
  });
  it('refuses unexpected nested calls', () => {
    expect(refuses([entry(user, commit([call(dep.contracts.config!, 'upgrade', [])]))])).toMatch(/unexpected nested call/);
    expect(refuses([entry(user, commit([call(dep.usdc, 'approve', [])]))])).toMatch(/unexpected nested call/);
  });
  it('enforces the amount the screen showed', () => {
    const e = entry(user, commit([transfer(user, dep.contracts.group_buy!, 101n)]));
    expect(refuses([e], { ...rules, maxTransfer: 100n } as never)).toMatch(/larger than the amount shown/);
    expect(refuses([e], { ...rules, maxTransfer: 101n } as never)).toBe('accepted');
  });
  it('refuses a request that needs nothing from this user, and ignores entries for others', () => {
    expect(refuses([entry(attacker, commit())])).toMatch(/nothing in this request/);
    expect(refuses([entry(user, commit()), entry(attacker, call(dep.contracts.config!, 'upgrade', []))])).toBe('accepted'); // we only sign our own
  });
});
