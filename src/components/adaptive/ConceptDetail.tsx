'use client';

import { useTranslations } from 'next-intl';
import { HiCheck } from 'react-icons/hi';
import { Modal } from '@/components/ui/Modal';
import type { ConceptDetail } from '@/features/adaptive/types/graph';

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

  const status =
    concept.status === 'locked'
      ? {
          label: t('knowledgeGraph.legend.locked'),
          className: 'bg-neutral-100 text-neutral-600',
        }
      : concept.status === 'mastered'
        ? { label: t('conceptDetail.mastered'), className: 'bg-green-100 text-green-700' }
        : concept.status === 'in_progress'
          ? {
              label: t('conceptDetail.inProgress'),
              className: 'bg-green-100 text-brand-trust-hover',
            }
          : {
              label: t('conceptDetail.notStarted'),
              className: 'bg-neutral-100 text-neutral-600',
            };

  const masteryBarClass = concept.status === 'locked' ? 'bg-neutral-400' : 'bg-brand-trust';

  return (
    <Modal isOpen onClose={onClose} title={concept.name} size="medium" className="max-w-lg">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
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

        {concept.definition ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              {t('conceptDetail.definition')}
            </h3>
            <p className="text-sm leading-relaxed text-neutral-700">{concept.definition}</p>
          </div>
        ) : null}

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
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
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
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
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
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
                      <HiCheck className="size-4 text-green-500" />
                    ) : (
                      <div className="size-4 rounded-full border-2 border-neutral-300" />
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
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
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
    </Modal>
  );
}
