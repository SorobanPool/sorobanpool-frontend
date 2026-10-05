import type { Deployment } from './verify';

/**
 * Public contract addresses, baked in at build time (NEXT_PUBLIC_DEPLOYMENTS = {"usdc":"C..","contracts":{"group_buy":"C.."}}).
 * The app refuses to sign without them: guarding the user's money must fail closed, not open.
 */
export function deployment(): Deployment {
  const raw = process.env.NEXT_PUBLIC_DEPLOYMENTS;
  if (!raw) throw new Error('NEXT_PUBLIC_DEPLOYMENTS is not set: refusing to sign transactions that cannot be verified');
  return JSON.parse(raw) as Deployment;
}
