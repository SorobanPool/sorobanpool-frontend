/**
 * Signs Soroban authorization entries with a passkey for the user's smart wallet (contracts ADR 0006).
 *
 * The wallet contract's `__check_auth` receives the Soroban signature payload and a `Signature` struct. The payload
 * becomes the WebAuthn challenge, so the fingerprint/face prompt authorises exactly this call, once. Nothing secret
 * is stored in the browser: the passkey lives in the phone's secure hardware (and the platform's passkey sync).
 *
 * The Stellar SDK is loaded only when something is signed, to keep trader pages inside the JS budget (ADR 0002).
 */

/** secp256r1 group order. WebAuthn may return a high-S signature; the Soroban host only accepts low-S. */
const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const HALF_N = P256_N >> 1n;

const toBig = (b: Uint8Array): bigint => b.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n);
const to32 = (n: bigint): Uint8Array => {
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
};

/** ASN.1 DER `SEQUENCE { INTEGER r, INTEGER s }` (what WebAuthn returns for ES256) -> 64-byte r || s with low S. */
export function derToCompactLowS(der: Uint8Array): Uint8Array {
  let i = 0;
  const fail = () => { throw new Error('BAD_SIGNATURE'); };
  if (der[i++] !== 0x30) fail();
  let len = der[i++]!;
  if (len & 0x80) i += len & 0x7f; // long-form length (never needed for P-256, tolerated)
  const int = (): bigint => {
    if (der[i++] !== 0x02) fail();
    len = der[i++]!;
    const v = der.subarray(i, i + len);
    i += len;
    if (v.length === 0 || v.length > 33) fail();
    return toBig(v);
  };
  const r = int();
  let s = int();
  if (r <= 0n || r >= P256_N || s <= 0n || s >= P256_N) fail();
  if (s > HALF_N) s = P256_N - s;
  const out = new Uint8Array(64);
  out.set(to32(r), 0);
  out.set(to32(s), 32);
  return out;
}

export interface PasskeyAssertion {
  credentialId: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  /** DER signature as returned by the authenticator. */
  signature: Uint8Array;
}

export type GetAssertion = (challenge: Uint8Array) => Promise<PasskeyAssertion>;

/**
 * Asks the platform for a user-verified passkey assertion over `challenge`. No allow-list: the person picks their
 * SorobanPool passkey (synced passkeys work on a new phone with nothing to restore); the wallet contract rejects
 * any passkey that is not one of its signers.
 */
export const browserAssertion: GetAssertion = async (challenge) => {
  const cred = (await navigator.credentials.get({
    publicKey: { challenge: challenge as BufferSource, userVerification: 'required', timeout: 120_000 },
  })) as PublicKeyCredential | null;
  if (!cred) throw Object.assign(new Error('USER_DECLINED'), { name: 'NotAllowedError' });
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    credentialId: new Uint8Array(cred.rawId),
    authenticatorData: new Uint8Array(r.authenticatorData),
    clientDataJSON: new Uint8Array(r.clientDataJSON),
    signature: new Uint8Array(r.signature),
  };
};

/**
 * Signs every entry whose credentials belong to `wallet`; entries for other addresses are returned untouched (the
 * backend refuses them). The SDK builds the signature payload, including the address-bound CAP-71 preimage that
 * testnet's V2 credentials use, and writes our struct verbatim as the credentials' signature.
 */
export async function signWithPasskey(
  entries: string[], wallet: string, validUntilLedger: number, passphrase: string, getAssertion: GetAssertion = browserAssertion,
): Promise<string[]> {
  const { Address, authorizeEntry, xdr } = await import('@stellar/stellar-sdk');
  const out: string[] = [];
  for (const e of entries) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(e, 'base64');
    const c = entry.credentials;
    const creds = c.type === 'sorobanCredentialsAddress' ? c.address : c.type === 'sorobanCredentialsAddressV2' ? c.addressV2 : null;
    if (!creds || Address.fromScAddress(creds.address).toString() !== wallet) {
      out.push(e);
      continue;
    }
    const signed = await authorizeEntry(entry, async (_preimage, payload) => {
      const a = await getAssertion(new Uint8Array(payload));
      return { signatureScVal: signatureScVal(xdr, a) };
    }, validUntilLedger, passphrase);
    out.push(signed.toXDR('base64'));
  }
  return out;
}

/** The wallet's `Signature` contracttype: an ScMap with symbol keys in sorted order, as Soroban requires. */
function signatureScVal(xdrNs: typeof import('@stellar/stellar-sdk').xdr, a: PasskeyAssertion) {
  const bytes = (b: Uint8Array) => xdrNs.ScVal.scvBytes(b as never);
  const field = (k: string, v: ReturnType<typeof bytes>) => new xdrNs.ScMapEntry({ key: xdrNs.ScVal.scvSymbol(k), val: v });
  return xdrNs.ScVal.scvMap([
    field('authenticator_data', bytes(a.authenticatorData)),
    field('client_data', bytes(a.clientDataJSON)),
    field('credential_id', bytes(a.credentialId)),
    field('signature', bytes(derToCompactLowS(a.signature))),
  ]);
}

