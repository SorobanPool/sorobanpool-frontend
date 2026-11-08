// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { Address, buildAuthorizationEntryPreimage, hash, Keypair, Networks, StrKey, xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { derToCompactLowS, signWithPasskey, type GetAssertion } from './passkey-signer';

const subtle = webcrypto.subtle;
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const big = (b: Uint8Array) => BigInt(`0x${Buffer.from(b).toString('hex') || '0'}`);

/** DER-encodes r || s the way authenticators return ES256 signatures. */
function toDer(rs: Uint8Array, s?: bigint): Uint8Array {
  const int = (v: Uint8Array) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    let x = v.subarray(i);
    if (x[0]! & 0x80) x = Uint8Array.from([0, ...x]);
    return Uint8Array.from([0x02, x.length, ...x]);
  };
  const sBytes = s === undefined ? rs.subarray(32) : Uint8Array.from(Buffer.from(s.toString(16).padStart(64, '0'), 'hex'));
  const body = Uint8Array.from([...int(rs.subarray(0, 32)), ...int(sBytes)]);
  return Uint8Array.from([0x30, body.length, ...body]);
}

/** A software platform authenticator: ES256 over authenticatorData || sha256(clientDataJSON), UP + UV set. */
async function authenticator(opts: { highS?: boolean } = {}) {
  const keys = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const credentialId = webcrypto.getRandomValues(new Uint8Array(16));
  const seen: Uint8Array[] = [];
  const getAssertion: GetAssertion = async (challenge) => {
    seen.push(challenge);
    const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge: b64url(challenge), origin: 'https://sorobanpool.app' }));
    const authenticatorData = Uint8Array.from([...new Uint8Array(32).fill(7), 0x05, 0, 0, 0, 1]);
    const msg = Uint8Array.from([...authenticatorData, ...new Uint8Array(await subtle.digest('SHA-256', clientDataJSON))]);
    const rs = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, msg));
    let s = big(rs.subarray(32));
    // Force the high-S form some authenticators return, to prove the client normalises it.
    if (opts.highS && s <= N >> 1n) s = N - s;
    if (!opts.highS && s > N >> 1n) s = N - s;
    return { credentialId, authenticatorData, clientDataJSON, signature: toDer(rs, s) };
  };
  return { keys, credentialId, getAssertion, seen };
}

const wallet = StrKey.encodeContract(Buffer.alloc(32, 5));
const groupBuy = StrKey.encodeContract(Buffer.alloc(32, 6));

function unsignedEntry(v2: boolean, who = wallet) {
  const creds = new xdr.SorobanAddressCredentials({ address: new Address(who).toScAddress(), nonce: 42n as never, signatureExpirationLedger: 0, signature: xdr.ScVal.scvVoid() });
  return new xdr.SorobanAuthorizationEntry({
    credentials: v2 ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(creds) : xdr.SorobanCredentials.sorobanCredentialsAddress(creds),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(new xdr.InvokeContractArgs({ contractAddress: new Address(groupBuy).toScAddress(), functionName: 'commit', args: [] })),
      subInvocations: [],
    }),
  });
}

const sigMap = (entry: xdr.SorobanAuthorizationEntry) => {
  const c = entry.credentials;
  if (c.type !== 'sorobanCredentialsAddressV2' && c.type !== 'sorobanCredentialsAddress') throw new Error('expected address credentials');
  const creds = c.type === 'sorobanCredentialsAddressV2' ? c.addressV2 : c.address;
  return { creds, map: (creds.signature as unknown as { map: { key: { sym: { toString(): string } }; val: { bytes: { value: Uint8Array } } }[] }).map };
};

describe('passkey signer', () => {
  for (const v2 of [true, false]) {
    it(`signs ${v2 ? 'V2 (CAP-71)' : 'legacy'} credentials over exactly the payload the host will check`, async () => {
      const a = await authenticator();
      const [signedXdr] = await signWithPasskey([unsignedEntry(v2).toXDR('base64')], wallet, 1234, Networks.TESTNET, a.getAssertion);
      const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr!, 'base64');
      const { creds, map } = sigMap(signed);
      expect(creds.signatureExpirationLedger).toBe(1234);

      // The WebAuthn challenge is the Soroban signature payload for this entry, expiry and network.
      const expected = hash(buildAuthorizationEntryPreimage(signed, 1234, Networks.TESTNET).toXDR());
      expect(Buffer.from(a.seen[0]!).equals(expected)).toBe(true);

      // Field names and order match the contract's `Signature` struct (Soroban maps are sorted by key).
      expect(map.map((e) => e.key.sym.toString())).toEqual(['authenticator_data', 'client_data', 'credential_id', 'signature']);
      const field = (k: string) => new Uint8Array(map.find((e) => e.key.sym.toString() === k)!.val.bytes.value);
      expect(Buffer.from(field('credential_id')).equals(Buffer.from(a.credentialId))).toBe(true);
      const sig = field('signature');
      expect(sig).toHaveLength(64);

      // The compact signature verifies the way the contract checks it: over authData || sha256(clientData).
      const msg = Uint8Array.from([...field('authenticator_data'), ...new Uint8Array(await subtle.digest('SHA-256', field('client_data')))]);
      expect(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, a.keys.publicKey, sig, msg)).toBe(true);
    });
  }

  it('normalises a high-S signature to low S, which the Soroban host requires, and it still verifies', async () => {
    const a = await authenticator({ highS: true });
    const [signedXdr] = await signWithPasskey([unsignedEntry(true).toXDR('base64')], wallet, 99, Networks.TESTNET, a.getAssertion);
    const { map } = sigMap(xdr.SorobanAuthorizationEntry.fromXDR(signedXdr!, 'base64'));
    const get = (k: string) => new Uint8Array(map.find((e) => e.key.sym.toString() === k)!.val.bytes.value);
    const sig = get('signature');
    expect(big(sig.subarray(32)) <= N >> 1n).toBe(true);
    const msg = Uint8Array.from([...get('authenticator_data'), ...new Uint8Array(await subtle.digest('SHA-256', get('client_data')))]);
    expect(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, a.keys.publicKey, sig, msg)).toBe(true);
  });

  it('leaves entries for other addresses untouched and never prompts for them', async () => {
    const a = await authenticator();
    const other = unsignedEntry(true, Keypair.random().publicKey()).toXDR('base64');
    expect(await signWithPasskey([other], wallet, 10, Networks.TESTNET, a.getAssertion)).toEqual([other]);
    expect(a.seen).toHaveLength(0);
  });

  it('rejects malformed DER', () => {
    expect(() => derToCompactLowS(Uint8Array.from([0x31, 0x00]))).toThrow('BAD_SIGNATURE');
    expect(() => derToCompactLowS(Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x00, 0x02, 0x01, 0x01]))).toThrow('BAD_SIGNATURE'); // r = 0
  });
});
