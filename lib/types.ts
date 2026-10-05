export interface Tier {
  minUnits: number;
  unitPrice: string; // stroops
}

export interface OfferView {
  id: string;
  title: string;
  brand: string | null;
  description: string;
  unitLabel: string;
  category: string;
  images: string[];
  moq: number;
  maxUnits: number;
  maxPerMember: number;
  leadTimeHours: number;
  tiersUsdc: Tier[];
  tiersNgn: { minUnits: number; priceNgn: string }[];
  validUntil: string;
}

export type PoolState = 'Open' | 'Filled' | 'Accepted' | 'Dispatched' | 'Delivered' | 'Settled' | 'Expired' | 'Failed' | 'Cancelled';

export interface PoolView {
  id: string;
  state: PoolState;
  shareSlug: string;
  offerId: string;
  organizer: string;
  supplier: string;
  hub: { address: string; contact: string };
  pickupWindow: { from?: string; to?: string };
  fillDeadline: string;
  totalUnits: number;
  receivedUnits: number | null;
  moq: number | null;
  maxUnits: number | null;
  members: number;
  ngnPerUsd: number | null;
  filledAt: string | null;
  progressPct: number;
  currentUnitPriceUsdc: string;
  currentUnitPriceNaira: string | null;
  nextBreak: { unitsToGo: number; unitPriceUsdc: string } | null;
  tiersUsdc: Tier[];
  finalUnitPriceUsdc: string | null;
  offer: OfferView | null;
  trustMessage: string;
  myCommitment?: { units: number; paid: string; pickedUp: boolean } | null;
}

export interface PoolCard {
  id: string;
  state: PoolState;
  organizer: string;
  supplier: string;
  shareSlug: string;
  title: string | null;
  unitLabel: string | null;
  currentUnitPriceNaira: string | null;
  moq: number | null;
  totalUnits: number;
  progressPct: number;
  fillDeadline: string;
  hub: string;
}

export interface DisputeView {
  id: string;
  poolId: string;
  opener: string;
  state: 'OPEN' | 'RESOLVED' | 'TIMED_OUT';
  claimedAmount: string; // USDC decimal string
  openedAt: string;
  slaDueAt: string;
  msToSla?: number;
}

export interface SupplierProfile {
  businessName: string;
  kybStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}
