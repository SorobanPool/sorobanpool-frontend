'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

/**
 * Collapsible section explaining what happens if the pool fails.
 * Shows before the pay button with three scenarios: not enough people, supplier no-show, short delivery.
 * Supports keyboard toggling and links to dispute help.
 */
export function FailureExplainer() {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations('pool.failureExplainer');
  
  return (
    <section className="rounded-lg border border-neutral-300 bg-neutral-50 p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-sm font-semibold text-neutral-900">
          {t('title')}
        </h3>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`size-5 text-neutral-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {expanded && (
        <div className="mt-4 space-y-4 text-sm">
          <Scenario 
            question={t('notEnoughPeople')}
            answer={t('notEnoughAnswer')}
          />
          
          <Scenario 
            question={t('supplierNoShow')}
            answer={t('supplierNoShowAnswer')}
          />
          
          <Scenario 
            question={t('shortDelivery')}
            answer={t('shortDeliveryAnswer')}
          />
          
          <Link 
            href="/help/disputes" 
            className="inline-block text-sm font-medium text-emerald-700 hover:text-emerald-900"
          >
            {t('learnMoreDisputes')} →
          </Link>
        </div>
      )}
    </section>
  );
}

interface ScenarioProps {
  question: string;
  answer: string;
}

function Scenario({ question, answer }: ScenarioProps) {
  return (
    <div>
      <p className="font-medium text-neutral-900">
        {question}
      </p>
      <p className="mt-1 text-neutral-700">
        {answer}
      </p>
    </div>
  );
}
