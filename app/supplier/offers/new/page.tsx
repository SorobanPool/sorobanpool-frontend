'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatNaira, formatUsdNumber } from '@/lib/format';
import { validateOfferTiers } from '@/lib/offer-tiers';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createOffer } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { AreaPicker } from '@/components/forms/AreaPicker';
import { SelectedArea } from '@/lib/areas';

interface TierRow {
  minUnits: number;
  priceNaira: number;
}

type Tab = 'form' | 'preview';

function OfferPreviewCard({
  title,
  brand,
  unitLabel,
  category,
  description,
  tiers,
  deliveryAreas,
  maxUnits,
  maxPerMember,
  leadTimeHours,
  validDays,
  ngnPerUsd,
}: {
  title: string;
  brand: string;
  unitLabel: string;
  category: string;
  description: string;
  tiers: TierRow[];
  deliveryAreas: SelectedArea[];
  maxUnits: number;
  maxPerMember: number;
  leadTimeHours: number;
  validDays: number;
  ngnPerUsd: number;
}) {
  const t = useTranslations('supplier.offer');
  const locale = useLocale();

  const lowestTier = tiers.length > 0 ? Math.min(...tiers.map((t) => t.priceNaira)) : 0;
  const highestTier = tiers.length > 0 ? Math.max(...tiers.map((t) => t.priceNaira)) : 0;

  const areaText =
    deliveryAreas.length === 0
      ? t('preview.noAreas')
      : deliveryAreas
          .map((a) => {
            const names: Record<string, string> = {
              AB: 'Abia', AD: 'Adamawa', AK: 'Akwa Ibom', AN: 'Anambra', BA: 'Bauchi',
              BY: 'Bayelsa', BE: 'Benue', BO: 'Borno', CR: 'Cross River', DE: 'Delta',
              EB: 'Ebonyi', ED: 'Edo', EK: 'Ekiti', EN: 'Enugu', FC: 'FCT',
              GO: 'Gombe', IM: 'Imo', JI: 'Jigawa', KD: 'Kaduna', KN: 'Kano',
              KT: 'Katsina', KB: 'Kebbi', KO: 'Kogi', KW: 'Kwara', LA: 'Lagos',
              NA: 'Nasarawa', NI: 'Niger', OG: 'Ogun', ON: 'Ondo', OS: 'Osun',
              OY: 'Oyo', PL: 'Plateau', RI: 'Rivers', SO: 'Sokoto', TA: 'Taraba',
              YO: 'Yobe', ZA: 'Zamfara',
            };
            const stateName = names[a.state] ?? a.state;
            return a.lga ? `${stateName} – ${a.lga}` : stateName;
          })
          .join(', ');

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="bg-indigo-600 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-100">{category}</p>
            <h2 className="mt-1 text-xl font-bold text-white">{title || t('preview.untitled')}</h2>
            {brand && <p className="mt-0.5 text-sm text-indigo-100">{brand}</p>}
          </div>
          {lowestTier > 0 && (
            <div className="text-right">
              <p className="text-xs text-indigo-100">{t('preview.priceFrom')}</p>
              <p className="text-2xl font-bold text-white">{formatNaira(lowestTier, locale)}</p>
              <p className="text-xs text-indigo-100">≈ {formatUsdNumber(lowestTier / ngnPerUsd, locale)} (estimated)</p>
              <p className="text-xs text-indigo-100">/{unitLabel || t('preview.unit')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {description && (
          <p className="text-sm text-gray-700 dark:text-gray-300">{description}</p>
        )}

        {tiers.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
              {t('preview.tierBreaks')}
            </h3>
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                      {t('preview.minUnits')}
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                      {t('preview.pricePerUnit')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier, i) => (
                    <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {tier.minUnits}+
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">
                        <>{formatNaira(tier.priceNaira, locale)}<span className="block text-xs font-normal text-gray-500">≈ {formatUsdNumber(tier.priceNaira / ngnPerUsd, locale)}</span></>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lowestTier !== highestTier && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {t('preview.savingsRange', {
                  pct: Math.round(((highestTier - lowestTier) / highestTier) * 100),
                })}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('preview.poolCap')}</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {maxUnits > 0 ? `${maxUnits} ${unitLabel || t('preview.units')}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('preview.maxPerMember')}</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {maxPerMember > 0 ? `${maxPerMember} ${unitLabel || t('preview.units')}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('preview.leadTime')}</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {leadTimeHours > 0 ? `${leadTimeHours}h` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('preview.validFor')}</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {validDays > 0 ? `${validDays} days` : '—'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('preview.deliveryAreas')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{areaText}</p>
        </div>

        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 px-4 py-3 text-xs text-indigo-700 dark:text-indigo-300">
          {t('preview.trustNote')}
        </div>
      </div>
    </div>
  );
}

export default function NewOfferPage() {
  const t = useTranslations('supplier.offer');
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useRequireAuth();

  const [tab, setTab] = useState<Tab>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [maxUnits, setMaxUnits] = useState(0);
  const [maxPerMember, setMaxPerMember] = useState(0);
  const [leadTimeHours, setLeadTimeHours] = useState(0);
  const [validDays, setValidDays] = useState(30);
  const [tiers, setTiers] = useState<TierRow[]>([{ minUnits: 1, priceNaira: 0 }]);
  const [deliveryAreas, setDeliveryAreas] = useState<SelectedArea[]>([]);
  const ngnPerUsd = Number(process.env.NEXT_PUBLIC_NGN_PER_USD ?? 1500);
  const tierValidation = validateOfferTiers(tiers);

  if (!auth) return null;

  function addTier() {
    setTiers((prev) => [...prev, { minUnits: 0, priceNaira: 0 }]);
  }

  function updateTier(idx: number, field: keyof TierRow, val: number) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t)));
  }

  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    if (!tierValidation.valid) {
      setError(tierValidation.errors.join(' '));
      setSubmitting(false);
      return;
    }
    try {
      await createOffer({
        title,
        brand,
        unitLabel,
        category,
        description,
        maxUnits,
        maxPerMember,
        leadTimeHours,
        validDays,
        tiers,
        deliveryAreas,
      });
      await queryClient.invalidateQueries({ queryKey: ['supplier-offers'] });
      router.push('/supplier');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('newTitle')}</h1>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {(['form', 'preview'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-600 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            {id === 'form' ? t('formTab') : t('previewTab')}
          </button>
        ))}
      </div>

      {tab === 'preview' ? (
        <OfferPreviewCard
          title={title}
          brand={brand}
          unitLabel={unitLabel}
          category={category}
          description={description}
          tiers={tiers}
          deliveryAreas={deliveryAreas}
          maxUnits={maxUnits}
          maxPerMember={maxPerMember}
          leadTimeHours={leadTimeHours}
          validDays={validDays}
          ngnPerUsd={ngnPerUsd}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('productSection')}</legend>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('titleLabel')}</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('brandLabel')}</label>
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('unitLabel')}</label>
                <input
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="kg, pcs, bag…"
                  className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('categoryLabel')}</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('descriptionLabel')}</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('tiersSection')}</legend>
            {tiers.map((tier, idx) => (
              <div key={idx} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('minUnitsLabel')}</label>
                  <input
                    type="number"
                    min={1}
                    value={tier.minUnits}
                    onChange={(e) => updateTier(idx, 'minUnits', Number(e.target.value))}
                    className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('priceNairaLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={tier.priceNaira}
                    onChange={(e) => updateTier(idx, 'priceNaira', Number(e.target.value))}
                    className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                </div>
                {tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(idx)} className="text-red-700 text-sm pb-2">
                    {t('removeTierButton')}
                  </button>
                )}
              </div>
            ))}
            {!tierValidation.valid && <div role="alert" className="space-y-1 rounded-md bg-red-50 p-3 text-sm text-red-700">{tierValidation.errors.map((message) => <p key={message}>{message}</p>)}</div>}
            <button
              type="button"
              onClick={addTier}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('addTierButton')}
            </button>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('deliverySection')}</legend>
            <AreaPicker value={deliveryAreas} onChange={setDeliveryAreas} />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('poolSettingsSection')}</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('maxUnitsLabel')}</label>
                <input
                  type="number"
                  min={0}
                  value={maxUnits}
                  onChange={(e) => setMaxUnits(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('maxPerMemberLabel')}</label>
                <input
                  type="number"
                  min={0}
                  value={maxPerMember}
                  onChange={(e) => setMaxPerMember(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('leadTimeLabel')}</label>
                <input
                  type="number"
                  min={0}
                  value={leadTimeHours}
                  onChange={(e) => setLeadTimeHours(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('validDaysLabel')}</label>
                <input
                  type="number"
                  min={1}
                  value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-500 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setTab('preview')}
              className="rounded-md border border-gray-500 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t('previewButton')}
            </button>
            <button
              type="submit"
              disabled={submitting || !tierValidation.valid}
              className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? t('publishing') : t('publishButton')}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
