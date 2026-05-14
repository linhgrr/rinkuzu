'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineX, HiCheck } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import type { ConceptDetail } from '@/features/adaptive-learning/types';

interface ConceptDetailPanelProps {
  concept: ConceptDetail;
  onClose: () => void;
}

const BLOOM_KEYS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
const BLOOM_COLORS = [
  'bg-neutral-500',
  'bg-green-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
];

export default function ConceptDetailPanel({ concept, onClose }: ConceptDetailPanelProps) {
  const t = useTranslations('adaptiveLearning');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      if (previousActiveElement.current instanceof HTMLElement)
        previousActiveElement.current.focus();
    };
  }, []);

  const status = useMemo(() => {
    if (concept.status === 'locked') {
      return {
        label: t('knowledgeGraph.legend.locked'),
        className: 'bg-neutral-100 text-neutral-600',
      };
    }
    if (concept.status === 'mastered') {
      return { label: t('conceptDetail.mastered'), className: 'bg-green-100 text-green-700' };
    }
    if (concept.status === 'in_progress') {
      return {
        label: t('conceptDetail.inProgress'),
        className: 'bg-green-100 text-brand-trust-hover',
      };
    }
    return { label: t('conceptDetail.notStarted'), className: 'bg-neutral-100 text-neutral-600' };
  }, [concept.status, t]);

  const masteryBarClass = concept.status === 'locked' ? 'bg-neutral-400' : 'bg-brand-trust';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t('common.close') || 'Close'}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={concept.name}
        className="mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between rounded-t-xl border-b border-neutral-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">{concept.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${status.className}`}
              >
                {status.label}
              </span>
              {concept.visit_count > 0 ? (
                <span className="text-xs text-neutral-500">
                  {t('conceptDetail.visits', { count: concept.visit_count })}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            ref={closeButtonRef}
            aria-label={t('common.close') || 'Close'}
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-neutral-100"
          >
            <HiOutlineX className="h-5 w-5 text-neutral-400" />
          </Button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {concept.definition ? (
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-neutral-500">
                {t('conceptDetail.definition')}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-700">{concept.definition}</p>
            </div>
          ) : null}

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">
              {t('conceptDetail.overallMastery')}
            </h3>
            <div className="flex items-center gap-3">
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full transition-[width] ${masteryBarClass}`}
                  style={{ width: `${concept.mastery * 100}%` }}
                />
              </div>
              <span className="text-lg font-bold text-neutral-900">
                {Math.round(concept.mastery * 100)}%
              </span>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">
              {t('conceptDetail.bloomBreakdown')}
            </h3>
            <div className="space-y-2">
              {concept.bloom_mastery.map((value, index) => (
                <div key={BLOOM_KEYS[index]} className="flex items-center gap-3">
                  <span className="w-20 truncate text-xs font-medium text-neutral-600">
                    {t(`bloom.${BLOOM_KEYS[index]}`)}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full transition-[width] ${BLOOM_COLORS[index] || 'bg-neutral-400'}`}
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-bold text-neutral-600">
                    {Math.round(value * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {concept.prerequisites.length > 0 ? (
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">
                {t('conceptDetail.prerequisites', { count: concept.prerequisites.length })}
              </h3>
              <div className="space-y-2">
                {concept.prerequisites.map((prereq) => (
                  <div
                    key={prereq.id}
                    className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {prereq.mastery >= 0.75 ? (
                        <HiCheck className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-neutral-300" />
                      )}
                      <span className="text-sm text-neutral-700">{prereq.name}</span>
                    </div>
                    <span
                      className={`text-xs font-bold ${prereq.mastery >= 0.75 ? 'text-green-600' : 'text-neutral-500'}`}
                    >
                      {Math.round(prereq.mastery * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {concept.dependents.length > 0 ? (
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">
                {t('conceptDetail.unlocks', { count: concept.dependents.length })}
              </h3>
              <div className="flex flex-wrap gap-2">
                {concept.dependents.map((dependent) => (
                  <span
                    key={dependent.id}
                    className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-brand-trust-hover"
                  >
                    {dependent.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
