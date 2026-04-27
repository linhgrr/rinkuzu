'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineAcademicCap } from '@/components/icons';
import { Spinner } from '@/components/ui/Spinner';
import { useKnowledgeGraph, useMasteryMatrix } from '@/hooks/useAdaptiveLearning';
import type { MasteryRow } from './types';

interface MasteryMatrixProps {
  sessionId: string;
  filterActiveOnly?: boolean;
}

const BLOOM_COLORS = [
  'bg-neutral-500',
  'bg-green-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
];
const BLOOM_TRANSLATION_BY_LABEL: Record<string, string> = {
  Remember: 'remember',
  Understand: 'understand',
  Apply: 'apply',
  Analyze: 'analyze',
  Evaluate: 'evaluate',
  Create: 'create',
};

function getMasteryColor(value: number): string {
  if (value >= 0.75) {
    return 'bg-brand-trust';
  }
  if (value >= 0.6) {
    return 'bg-green-300';
  }
  if (value >= 0.5) {
    return 'bg-yellow-300';
  }
  if (value >= 0.4) {
    return 'bg-orange-200';
  }
  return 'bg-neutral-200';
}

function getMasteryTextColor(value: number): string {
  if (value >= 0.6) {
    return 'text-white';
  }
  return 'text-neutral-700';
}

function getMasteryBand(value: number) {
  if (value >= 0.75) return 'H';
  if (value >= 0.6) return 'M';
  if (value >= 0.4) return 'L';
  return 'N';
}

function getAverage(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function MasteryMatrix({ sessionId, filterActiveOnly = false }: MasteryMatrixProps) {
  const t = useTranslations('adaptiveLearning');
  const { data: matrixData, isLoading: matrixLoading } = useMasteryMatrix(sessionId);
  const { data: graphData, isLoading: graphLoading } = useKnowledgeGraph(
    filterActiveOnly ? sessionId : undefined,
  );
  const [sortBy, setSortBy] = useState<'name' | 'mastery'>('mastery');

  const handleSortByMastery = useCallback(() => {
    setSortBy('mastery');
  }, []);

  const handleSortByName = useCallback(() => {
    setSortBy('name');
  }, []);

  const data = matrixData;
  const loading = matrixLoading || (filterActiveOnly && graphLoading);

  const activeConceptIds = useMemo(() => {
    if (!filterActiveOnly || !graphData) return null;
    return new Set(
      graphData.nodes
        .filter((node) => node.status === 'in_progress' || node.status === 'available')
        .map((node) => node.id),
    );
  }, [filterActiveOnly, graphData]);

  const localizedBloomLabels = useMemo(() => {
    if (!data?.bloom_labels?.length) {
      return [];
    }

    return data.bloom_labels.map((label) => {
      const mappedKey = BLOOM_TRANSLATION_BY_LABEL[label];
      return mappedKey ? t(`bloom.${mappedKey}`) : label;
    });
  }, [data?.bloom_labels, t]);

  const sortedMatrix = useMemo(() => {
    if (!data?.matrix?.length) {
      return [];
    }

    const filteredInputMatrix = activeConceptIds
      ? data.matrix.filter((row) => activeConceptIds.has(row.concept_id))
      : data.matrix;

    const rowsWithAverage: Array<MasteryRow & { avgMastery: number }> = filteredInputMatrix.map(
      (row) => ({
        ...row,
        avgMastery: getAverage(row.bloom_levels),
      }),
    );

    return rowsWithAverage.sort((a, b) => {
      if (sortBy === 'mastery') {
        return b.avgMastery - a.avgMastery;
      }
      return a.concept_name.localeCompare(b.concept_name);
    });
  }, [activeConceptIds, data, sortBy]);

  const displayMatrix = useMemo(() => sortedMatrix.slice(0, 30), [sortedMatrix]);

  if (loading) {
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-8">
        <div className="mb-4 flex items-center gap-3">
          <Spinner />
          <span className="text-neutral-500 font-medium">{t('masteryMatrix.loading')}</span>
        </div>
      </div>
    );
  }

  if (!data || data.matrix.length === 0 || displayMatrix.length === 0) {
    return (
      <div className="flex h-[200px] w-full flex-col items-center justify-center gap-3 rounded-md border border-neutral-200 bg-neutral-50">
        <HiOutlineAcademicCap className="h-10 w-10 text-neutral-300" />
        <p className="text-sm text-neutral-500">{t('masteryMatrix.noData')}</p>
        <p className="text-xs text-neutral-400">{t('masteryMatrix.noDataHint')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 bg-neutral-50/50">
        <div>
          <h3 className="text-base font-medium tracking-tight text-neutral-900">
            {t('masteryMatrix.title')}
          </h3>
          <p className="text-sm text-neutral-500">{t('masteryMatrix.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSortByMastery}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === 'mastery'
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-50'
            }`}
          >
            {t('masteryMatrix.sortByMastery')}
          </button>
          <button
            onClick={handleSortByName}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === 'name'
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-50'
            }`}
          >
            {t('masteryMatrix.sortByName')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="sticky left-0 z-10 w-48 bg-neutral-50 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] shadow-[1px_0_0_0_var(--neutral-100)]">
                {t('masteryMatrix.concept')}
              </th>
              {data.bloom_labels.map((label, index) => {
                const localizedLabel = localizedBloomLabels[index] || label;
                return (
                  <th
                    key={`${label}-${index}`}
                    className="w-20 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    <div
                      className={`mx-auto mb-1.5 h-2 w-2 rounded-full ${BLOOM_COLORS[index] || 'bg-neutral-400'}`}
                    />
                    {localizedLabel.substring(0, 3)}
                  </th>
                );
              })}
              <th className="w-20 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {t('masteryMatrix.avg')}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayMatrix.map((row, rowIndex) => {
              const isEven = rowIndex % 2 === 0;
              return (
                <tr
                  key={row.concept_id}
                  className={`border-b border-neutral-100 last:border-0 ${isEven ? 'bg-white' : 'bg-neutral-50/50'}`}
                >
                  <td
                    className={`sticky left-0 z-10 max-w-[200px] sm:max-w-[300px] truncate px-4 py-3.5 text-sm font-medium text-[var(--text-primary)] shadow-[1px_0_0_0_var(--neutral-100)] ${isEven ? 'bg-white' : 'bg-neutral-50'}`}
                  >
                    {row.concept_name}
                  </td>
                  {row.bloom_levels.map((value, colIndex) => {
                    const localizedLabel =
                      localizedBloomLabels[colIndex] || data.bloom_labels[colIndex] || '';
                    return (
                      <td key={`${row.concept_id}-${colIndex}`} className="px-1 py-1 text-center">
                        <div
                          className={`mx-auto flex h-8 w-14 items-center justify-center rounded-md text-xs font-mono font-medium transition-colors ${getMasteryColor(value)} ${getMasteryTextColor(value)}`}
                          title={`${row.concept_name} - ${localizedLabel}: ${Math.round(value * 100)}%`}
                        >
                          {Math.round(value * 100)} {getMasteryBand(value)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center">
                    <span
                      className={`text-sm font-mono font-semibold ${row.avgMastery >= 0.75 ? 'text-green-600' : 'text-neutral-500'}`}
                    >
                      {Math.round(row.avgMastery * 100)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedMatrix.length > 30 ? (
        <div className="border-t border-neutral-100 px-6 py-3 text-center text-sm text-neutral-500">
          {t('masteryMatrix.showingTop', { count: sortedMatrix.length })}
        </div>
      ) : null}

      <div className="flex items-center gap-4 border-t border-neutral-100 px-6 py-3 text-xs text-neutral-500">
        <span className="font-medium">{t('masteryMatrix.legend')}</span>
        <div className="flex items-center gap-1">
          <div className="h-3 w-4 rounded bg-neutral-200" /> {t('masteryMatrix.rangeLt40')}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-4 rounded bg-orange-200" /> {t('masteryMatrix.range40To50')}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-4 rounded bg-yellow-300" /> {t('masteryMatrix.range50To60')}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-4 rounded bg-green-300" /> {t('masteryMatrix.range60To75')}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-4 rounded bg-brand-trust" /> {t('masteryMatrix.range75Plus')}
        </div>
        <span className="text-neutral-400">N: None · L: Low · M: Medium · H: High</span>
      </div>
    </div>
  );
}
