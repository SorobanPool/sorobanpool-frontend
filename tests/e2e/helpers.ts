import { readFileSync } from 'node:fs';
import { Address, Asset, authorizeEntry, Contract, Keypair, Operation, rpc, TransactionBuilder, xdr, Account, BASE_FEE, scValToNative } from '@stellar/stellar-sdk';
import type { BrowserContext, Page } from '@playwright/test';

export const API = `${process.env.E2E_API ?? 'http://localhost:3100'}/v1`;
export const PASSPHRASE = 'Test SDF Network ; September 2015';
export const ADMIN_PHONE = '+2348000000001';
const DEPLOYMENTS = JSON.parse(readFileSync(process.env.DEPLOYMENTS_FILE ?? '../sorobanpool-contracts/deployments/testnet.json', 'utf8')) as { usdc: string; admin: string };
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimal JSON API client for setup that is not the thing under test. */
export class Client {
  token = '';
  constructor(public phone: string) {}
  async call<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`${method ?? 'GET/POST'} ${path} -> ${res.status} ${text}`);
    return json as T;
  }
  async login(): Promise<this> {
    const r = await this.call('/auth/otp/request', { phone: this.phone });
    const v = await this.call('/auth/otp/verify', { phone: this.phone, code: r.devCode });
    this.token = v.accessToken;
    return this;
  }
}

const server = () => new rpc.Server(process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org');

async function signEntries(entries: string[], kp: Keypair, validUntil: number): Promise<string[]> {
  const out: string[] = [];
  for (const e of entries) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(e, 'base64');
    const c = entry.credentials;
    const who = c.type === 'sorobanCredentialsAddress' ? Address.fromScAddress(c.address.address).toString() : c.type === 'sorobanCredentialsAddressV2' ? Address.fromScAddress(c.addressV2.address).toString() : null;
    out.push(who === kp.publicKey() ? (await authorizeEntry(entry, kp, validUntil, PASSPHRASE)).toXDR('base64') : e);
  }
  return out;
}

/** prepare -> sign with the user's key -> submit, exactly as the app does. */
export async function act(c: Client, kp: Keypair, path: string, body: unknown = {}): Promise<{ hash: string }> {
  const p = await c.call(path, body);
  const signed = await signEntries(p.authEntries, kp, p.validUntilLedger);
  return c.call('/tx/submit', { txXdr: p.txXdr, signedAuthEntries: signed, idempotencyKey: `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}` });
}

/** A funded user created purely through the API: wallet bound, test money, registered on-chain. */
export async function makeActor(phone: string, role: 'Trader' | 'Organizer' | 'Supplier', opts: { money?: boolean; cluster?: string } = {}): Promise<{ c: Client; kp: Keypair }> {
  const c = await new Client(phone).login();
  const kp = Keypair.random();
  const ch = await c.call('/wallets/challenge');
  await c.call('/wallets', { address: kp.publicKey(), signature: Buffer.from(kp.sign(Buffer.from(ch.challenge))).toString('base64') });
  if (opts.money !== false) await fund(c, kp);
  await act(c, kp, '/registry/register/prepare', { role, cluster: opts.cluster });
  return { c, kp };
}

export async function fund(c: Client, kp: Keypair): Promise<void> {
  const s = await c.call('/dev/faucet/start', {});
  const tx = TransactionBuilder.fromXDR(s.trustlineXdr, PASSPHRASE);
  tx.sign(kp);
  await c.call('/dev/faucet/finish', { signedXdr: tx.toXDR() });
}

export async function usdcBalance(address: string): Promise<bigint> {
  const sv = server();
  const acct = await sv.getAccount(DEPLOYMENTS.admin);
  const tx = new TransactionBuilder(new Account(acct.accountId(), acct.sequenceNumber()), { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(DEPLOYMENTS.usdc).call('balance', new Address(address).toScVal())).setTimeout(60).build();
  const sim = await sv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return BigInt(scValToNative((sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval) as bigint);
}

/** Network throttling like Chrome DevTools presets. */
export async function throttle(page: Page, profile: 'fast3g' | 'slow3g'): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const p = profile === 'slow3g' ? { latency: 400, down: 400 * 1024, up: 400 * 1024 } : { latency: 150, down: 1.6 * 1024 * 1024, up: 750 * 1024 };
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: p.latency, downloadThroughput: p.down / 8, uploadThroughput: p.up / 8 });
}

/** A virtual platform authenticator so the "confirm with fingerprint/face" gate can be exercised for real. */
export async function addVirtualAuthenticator(context: BrowserContext, page: Page): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

export async function waitFor(fn: () => Promise<boolean>, what: string, ms = 120_000, every = 3000): Promise<void> {
  const end = Date.now() + ms;
  for (;;) {
    if (await fn()) return;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(every);
  }
}

export { Asset, Operation };
