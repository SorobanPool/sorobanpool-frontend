'use client';
import { useTranslations } from 'next-intl';

type SupplierTier = 'S0' | 'S1' | 'S2' | 'S3';

interface SupplierBadgeProps {
  tier?: SupplierTier | null;
  settledPools?: number | null;
  disputeRate?: number | null;
}

/**
 * Shows supplier reputation tier (S0 to S3), settled pool count and dispute history summary.
 * Gracefully hidden when data is missing.
 */
export function SupplierBadge({ 
  tier, 
  settledPools, 
  disputeRate 
}: SupplierBadgeProps) {
  const t = useTranslations('supplier');
  
  // Hide entirely if no data
  if (!tier && settledPools === null && settledPools === undefined) {
    return null;
  }
  
  return (
    <section 
      aria-labelledby="supplier-rep-h" 
      className="rounded-xl border border-neutral-200 bg-white p-4"
    >
      <h2 id="supplier-rep-h" className="mb-3 text-sm font-semibold text-neutral-900">
        {t('reputation')}
      </h2>
      
      <div className="space-y-3">
        {tier && (
          <div className="flex items-center gap-3">
            <TierBadge tier={tier} />
            <div className="flex-1">
              <p className="text-sm font-medium">{getTierLabel(tier, t)}</p>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-neutral-600 hover:text-neutral-900">
                  {t('whatIsThis')}
                </summary>
                <p className="mt-2 text-xs text-neutral-700">
                  {getTierExplanation(tier, t)}
                </p>
              </details>
            </div>
          </div>
        )}
        
        {settledPools !== null && settledPools !== undefined && (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900">{settledPools}</span>
            <span className="text-sm text-neutral-600">
              {t('settledPools', { count: settledPools })}
            </span>
          </div>
        )}
        
        {disputeRate !== null && disputeRate !== undefined && (
          <div className="flex items-baseline gap-2">
            <span className={`text-sm font-medium ${disputeRate < 5 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {disputeRate.toFixed(1)}%
            </span>
            <span className="text-sm text-neutral-600">
              {t('disputeRate')}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function TierBadge({ tier }: { tier: SupplierTier }) {
  const colors = {
    S0: 'bg-neutral-200 text-neutral-700',
    S1: 'bg-amber-100 text-amber-800',
    S2: 'bg-emerald-100 text-emerald-800',
    S3: 'bg-blue-100 text-blue-800'
  };
  
  return (
    <div className={`flex size-12 items-center justify-center rounded-lg ${colors[tier]} text-lg font-bold`}>
      {tier}
    </div>
  );
}

function getTierLabel(tier: SupplierTier, t: (key: string) => string): string {
  const labels: Record<SupplierTier, string> = {
    S0: t('tierS0Label'),
    S1: t('tierS1Label'),
    S2: t('tierS2Label'),
    S3: t('tierS3Label')
  };
  return labels[tier];
}

function getTierExplanation(tier: SupplierTier, t: (key: string) => string): string {
  const explanations: Record<SupplierTier, string> = {
    S0: t('tierS0Explain'),
    S1: t('tierS1Explain'),
    S2: t('tierS2Explain'),
    S3: t('tierS3Explain')
  };
  return explanations[tier];
}
