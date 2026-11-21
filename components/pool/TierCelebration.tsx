'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatNaira } from '@/lib/format';

interface TierCelebrationProps {
  poolId: string;
  currentPrice: string;
  previousPrice?: string | null;
  tierLevel: number;
}

/**
 * Lightweight, motion-safe banner shown once per tier per device when pool reaches a better tier.
 * Dismissed state remembered per pool and tier in localStorage.
 */
export function TierCelebration({ 
  poolId, 
  currentPrice, 
  previousPrice,
  tierLevel 
}: TierCelebrationProps) {
  const t = useTranslations('pool');
  const [visible, setVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Only show if price actually dropped and we have previous price
    if (!previousPrice || !currentPrice || previousPrice === currentPrice) return;
    
    // Check if already dismissed for this pool and tier
    const storageKey = `tier-celebration-${poolId}-${tierLevel}`;
    const dismissed = localStorage.getItem(storageKey);
    
    if (!dismissed) {
      setVisible(true);
    }
  }, [poolId, tierLevel, currentPrice, previousPrice]);

  const handleDismiss = () => {
    const storageKey = `tier-celebration-${poolId}-${tierLevel}`;
    localStorage.setItem(storageKey, 'true');
    setVisible(false);
  };

  if (!visible || !previousPrice) return null;

  const savings = calculateSavings(previousPrice, currentPrice);
  const animationClass = prefersReducedMotion ? '' : 'animate-slide-in';

  return (
    <div 
      role="status"
      aria-live="polite"
      className={`rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 ${animationClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🎉</span>
            <h3 className="text-lg font-bold text-emerald-900">
              {t('tierReached')}
            </h3>
          </div>
          <p className="text-sm text-emerald-900">
            {t('newPrice')}: <span className="font-bold">₦{currentPrice}</span> per unit
          </p>
          {savings > 0 && (
            <p className="mt-1 text-sm font-medium text-emerald-700">
              {t('savingsNow', { amount: formatNaira(savings) })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-emerald-900 hover:text-emerald-700"
          aria-label="Dismiss"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="size-6" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function calculateSavings(oldPrice: string, newPrice: string): number {
  const old = parseFloat(oldPrice.replace(/,/g, ''));
  const current = parseFloat(newPrice.replace(/,/g, ''));
  return Math.max(0, old - current);
}
