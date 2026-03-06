'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineX, HiCheck } from '@/components/icons';
import type { ConceptDetail } from './types';

interface ConceptDetailPanelProps {
    concept: ConceptDetail;
    onClose: () => void;
}

const BLOOM_KEYS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
const BLOOM_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500', 'bg-blue-500'];

export default function ConceptDetailPanel({ concept, onClose }: ConceptDetailPanelProps) {
    const t = useTranslations('adaptiveLearning');

    const status = useMemo(() => {
        if (concept.status === 'locked') {
            return { label: t('knowledgeGraph.legend.locked'), className: 'bg-gray-100 text-gray-600' };
        }
        if (concept.status === 'mastered') {
            return { label: t('conceptDetail.mastered'), className: 'bg-green-100 text-green-700' };
        }
        if (concept.status === 'in_progress') {
            return { label: t('conceptDetail.inProgress'), className: 'bg-blue-100 text-blue-700' };
        }
        return { label: t('conceptDetail.notStarted'), className: 'bg-gray-100 text-gray-600' };
    }, [concept.status, t]);

    const masteryBarClass = concept.status === 'locked'
        ? 'bg-gray-400'
        : concept.mastery >= 0.75
            ? 'bg-green-500'
            : 'bg-blue-500';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div
                className="mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-start justify-between rounded-t-xl border-b border-gray-100 bg-white px-6 py-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{concept.name}</h2>
                        <div className="mt-1 flex items-center gap-2">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>
                                {status.label}
                            </span>
                            {concept.visit_count > 0 ? (
                                <span className="text-xs text-gray-500">{t('conceptDetail.visits', { count: concept.visit_count })}</span>
                            ) : null}
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-gray-100">
                        <HiOutlineX className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                <div className="space-y-6 px-6 py-5">
                    {concept.definition ? (
                        <div>
                            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">{t('conceptDetail.definition')}</h3>
                            <p className="text-sm leading-relaxed text-gray-700">{concept.definition}</p>
                        </div>
                    ) : null}

                    <div>
                        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">{t('conceptDetail.overallMastery')}</h3>
                        <div className="flex items-center gap-3">
                            <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
                                <div
                                    className={`h-full rounded-full transition-all ${masteryBarClass}`}
                                    style={{ width: `${concept.mastery * 100}%` }}
                                />
                            </div>
                            <span className="text-lg font-bold text-gray-900">{Math.round(concept.mastery * 100)}%</span>
                        </div>
                    </div>

                    <div>
                        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">{t('conceptDetail.bloomBreakdown')}</h3>
                        <div className="space-y-2">
                            {concept.bloom_mastery.map((value, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <span className="w-20 truncate text-xs font-medium text-gray-600">{t(`bloom.${BLOOM_KEYS[index]}`)}</span>
                                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                        <div
                                            className={`h-full rounded-full transition-all ${BLOOM_COLORS[index] || 'bg-gray-400'}`}
                                            style={{ width: `${value * 100}%` }}
                                        />
                                    </div>
                                    <span className="w-10 text-right text-xs font-bold text-gray-600">{Math.round(value * 100)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {concept.prerequisites.length > 0 ? (
                        <div>
                            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
                                {t('conceptDetail.prerequisites', { count: concept.prerequisites.length })}
                            </h3>
                            <div className="space-y-2">
                                {concept.prerequisites.map((prereq) => (
                                    <div key={prereq.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            {prereq.mastery >= 0.75 ? (
                                                <HiCheck className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                                            )}
                                            <span className="text-sm text-gray-700">{prereq.name}</span>
                                        </div>
                                        <span className={`text-xs font-bold ${prereq.mastery >= 0.75 ? 'text-green-600' : 'text-gray-500'}`}>
                                            {Math.round(prereq.mastery * 100)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {concept.dependents.length > 0 ? (
                        <div>
                            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
                                {t('conceptDetail.unlocks', { count: concept.dependents.length })}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {concept.dependents.map((dependent) => (
                                    <span key={dependent.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
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
