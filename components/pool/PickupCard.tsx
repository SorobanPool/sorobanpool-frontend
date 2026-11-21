'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface PickupCardProps {
  hubAddress: string;
  hubContact?: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  allocatedUnits: number;
  onConfirm: () => Promise<void>;
  confirmed: boolean;
}

export function PickupCard({
  hubAddress,
  hubContact,
  pickupWindowStart,
  pickupWindowEnd,
  allocatedUnits,
  onConfirm,
  confirmed,
}: PickupCardProps) {
  const t = useTranslations('pickup');
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const openMaps = () => {
    // Open system maps app with the address
    const encoded = encodeURIComponent(hubAddress);
    // Try Google Maps URL scheme first, falls back to web on iOS/Android
    const url = `https://maps.google.com/?q=${encoded}`;
    window.open(url, '_blank');
  };

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-emerald-950">{t('title')}</h2>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-emerald-900">{t('location')}</p>
          <p className="mt-1 text-neutral-900">{hubAddress}</p>
          {hubContact && (
            <p className="mt-1 text-sm text-neutral-700">
              {t('contact')}: {hubContact}
            </p>
          )}
          <button
            type="button"
            onClick={openMaps}
            className="mt-2 inline-flex items-center text-sm font-semibold text-emerald-700 hover:underline"
          >
            {t('openMaps')} →
          </button>
        </div>

        <div>
          <p className="text-sm font-medium text-emerald-900">{t('window')}</p>
          <p className="mt-1 text-neutral-900">
            {formatTime(pickupWindowStart)} – {formatTime(pickupWindowEnd)}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-emerald-900">{t('units')}</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{allocatedUnits}</p>
        </div>

        {!confirmed && (
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={confirming}
            className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60"
          >
            {confirming ? t('confirming') : t('confirmButton')}
          </button>
        )}

        {confirmed && (
          <div className="rounded-lg bg-white p-3 text-center font-semibold text-emerald-900">
            {t('confirmed')}
          </div>
        )}
      </div>
    </div>
  );
}
