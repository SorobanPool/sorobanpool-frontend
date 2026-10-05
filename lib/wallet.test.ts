// @vitest-environment node
import { Address, Keypair, StrKey, xdr } from '@stellar/stellar-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => void store.set(k, v),
  del: async (k: string) => void store.delete(k),
}));

import { backupSecret, clearWallet, confirmWithDevice, createWallet, importWallet, loadWallet, signAuthEntries, signChallenge } from './wallet';

beforeEach(async () => {
  store.clear();
  await clearWallet();
});

describe('device wallet', () => {
  it('creates, persists and reloads a wallet; the secret is never exposed by loadWallet', async () => {
    expect(await loadWallet()).toBeNull();
    const { publicKey } = await createWallet();
    expect(StrKey.isValidEd25519PublicKey(publicKey)).toBe(true);
    expect(await loadWallet()).toEqual({ publicKey });
    expect(JSON.stringify(await loadWallet())).not.toMatch(/^S/);
    expect(StrKey.isValidEd25519SecretSeed(await backupSecret())).toBe(true);
  });

  it('restores from a backup secret to the same public key', async () => {
    const kp = Keypair.random();
    expect((await importWallet(kp.secret())).publicKey).toBe(kp.publicKey());
    await expect(importWallet('not a secret')).rejects.toThrow();
  });

  it('signs the server challenge so the backend can verify possession', async () => {
    const { publicKey } = await createWallet();
    const sig = await signChallenge('abc123');
    expect(Keypair.fromPublicKey(publicKey).verify(Buffer.from('abc123'), Buffer.from(sig, 'base64'))).toBe(true);
  });

  it('reports the biometric gate as unavailable when the device has none (no WebAuthn here)', async () => {
    await createWallet();
    expect(await confirmWithDevice()).toBe('unavailable');
  });
});

describe('signAuthEntries', () => {
  const contract = StrKey.encodeContract(Buffer.alloc(32, 7));
  const entryFor = (who: string, v2: boolean) => {
    const creds = new xdr.SorobanAddressCredentials({ address: new Address(who).toScAddress(), nonce: 1n, signatureExpirationLedger: 0, signature: xdr.ScVal.scvVoid() });
    return new xdr.SorobanAuthorizationEntry({
      credentials: v2 ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(creds) : xdr.SorobanCredentials.sorobanCredentialsAddress(creds),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(new xdr.InvokeContractArgs({ contractAddress: new Address(contract).toScAddress(), functionName: 'commit', args: [] })),
        subInvocations: [],
      }),
    });
  };
  const signatureOf = (b64: string) => {
    const c = xdr.SorobanAuthorizationEntry.fromXDR(b64, 'base64').credentials;
    return c.type === 'sorobanCredentialsAddressV2' ? c.addressV2.signature : c.type === 'sorobanCredentialsAddress' ? c.address.signature : undefined;
  };

  it.each([[false, 'plain'], [true, 'V2']])('signs %s address credentials (%s) for this wallet', async (v2) => {
    const { publicKey } = await createWallet();
    const [signed] = await signAuthEntries([entryFor(publicKey, v2).toXDR('base64')], 5000, 'Test SDF Network ; September 2015');
    expect(signatureOf(signed!)?.type).not.toBe('scvVoid'); // it was actually signed
  });

  it("leaves entries for other accounts untouched", async () => {
    await createWallet();
    const other = entryFor(Keypair.random().publicKey(), true).toXDR('base64');
    const [out] = await signAuthEntries([other], 5000, 'Test SDF Network ; September 2015');
    expect(out).toBe(other);
  });
});
