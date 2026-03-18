'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import {
    HiOutlineAcademicCap,
    HiOutlineChartBar,
    HiArrowRight,
    HiOutlineBookOpen,
    HiCheck,
    HiOutlineX,
    HiOutlineEye,
} from '@/components/icons';
import { getSessionHistory } from './api-client';
import { BLOOM_LABELS } from './types';
import type { SessionHistoryItem, ExerciseHistoryFull } from './types';

function formatDate(ts: number, locale: string = 'vi-VN') {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
    });
}

function MasteryBar({ value }: { value: number }) {
    const pct = Math.round(value * 100);
    const color =
        pct >= 70 ? 'bg-gray-900' : pct >= 40 ? 'bg-gray-400' : 'bg-gray-200';
    return (
        <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-mono text-gray-500 w-9 text-right">{pct}%</span>
        </div>
    );
}

interface SessionRowProps {
    item: SessionHistoryItem;
    onOpen: (id: string) => void;
}

function SessionRow({ item, onOpen }: SessionRowProps) {
    const t = useTranslations('adaptiveLearning');
    const locale = useLocale();
    const accuracy = Math.round(item.accuracy * 100);
    const grade = accuracy >= 80 ? 'A+' : accuracy >= 60 ? 'B' : 'C';
    const gradeColor =
        accuracy >= 80 ? 'text-gray-900 bg-gray-100 border-gray-200' : accuracy >= 60 ? 'text-gray-700 bg-gray-50 border-gray-100' : 'text-gray-500 bg-gray-50 border-gray-100';
    const isCompleted = item.status === 'completed';

    return (
        <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-800 transition-colors duration-200 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between group cursor-pointer" onClick={() => onOpen(item.session_id)}>
            {/* Left info */}
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-md flex items-center justify-center font-mono font-medium text-lg border ${gradeColor}`}>
                    {grade}
                </div>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-gray-900 text-base max-w-[200px] truncate" title={item.session_id}>
                            {item.session_id.substring(0, 8)}...
                        </span>
                        {isCompleted ? (
                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-700">
                                {t('history.completed')}
                            </span>
                        ) : (
                            <span className="inline-flex items-center rounded-md bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                                {t('history.step', { step: item.step })}
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{formatDate(item.updated_at, locale)}</div>
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 sm:gap-10">
                <div className="hidden md:flex flex-col items-end">
                    <span className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">{t('history.correct')}</span>
                    <span className="text-sm font-mono text-gray-900">{item.total_correct}/{item.total_answered}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">{t('stats.averageMastery')}</span>
                    <div className="flex items-center gap-3">
                        <div className="h-1.5 w-20 bg-gray-100 rounded-full border border-gray-200 overflow-hidden">
                            <div className={`h-full rounded-full ${accuracy >= 70 ? 'bg-gray-900' : 'bg-gray-400'}`} style={{ width: `${Math.round(item.avg_mastery * 100)}%` }} />
                        </div>
                        <span className="text-sm font-mono text-gray-900 w-9 text-right">{Math.round(item.avg_mastery * 100)}%</span>
                    </div>
                </div>
                <div className="text-gray-400 group-hover:text-gray-900 transition-colors hidden sm:flex h-8 w-8 items-center justify-center">
                    <HiArrowRight className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
}

export default function SessionHistory() {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        getSessionHistory(30)
            .then((data) => { if (mounted) setSessions(data); })
            .catch((e) => { if (mounted) setError(e.message); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const handleOpen = useCallback((sessionId: string) => {
        router.push(`/adaptive-learning/subject/${sessionId}`);
    }, [router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                <span className="text-sm">{t('history.loading')}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                {t('history.loadError', { error })}
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-2">
                <HiOutlineAcademicCap className="w-10 h-10 opacity-40" />
                <p className="text-sm">{t('history.noSession')}</p>
                <p className="text-xs text-gray-300">{t('history.sessionSaveHint')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {sessions.map((item) => (
                <SessionRow key={item.session_id} item={item} onOpen={handleOpen} />
            ))}
        </div>
    );
}


// ---- Inline Exercise History Detail (shown inside SubjectDetails via tab) ----

interface ExerciseHistoryTableProps {
    exercises: ExerciseHistoryFull[];
}

export function ExerciseHistoryTable({ exercises }: ExerciseHistoryTableProps) {
    const t = useTranslations('adaptiveLearning');
    const locale = useLocale();

    const getBloomLabel = useCallback((level: number) => {
        const enLabel = BLOOM_LABELS[Math.max(0, Math.min(BLOOM_LABELS.length - 1, level - 1))] || 'Remember';
        return t(`bloom.${enLabel.toLowerCase()}` as any);
    }, [t]);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedExercise, setSelectedExercise] = useState<ExerciseHistoryFull | null>(null);
    const pageSize = 10;
    
    const totalPages = Math.ceil((exercises?.length || 0) / pageSize);
    const paginatedExercises = useMemo(() => {
        if (!exercises) return [];
        const start = (currentPage - 1) * pageSize;
        return exercises.slice(start, start + pageSize);
    }, [exercises, currentPage, pageSize]);

    if (!exercises?.length) {
        return <p className="text-sm text-gray-400 py-4 text-center">{t('history.table.noExercise')}</p>;
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                            <th className="px-5 py-3 text-left">#</th>
                            <th className="px-5 py-3 text-left">{t('masteryMatrix.concept')}</th>
                            <th className="px-5 py-3 text-left">Bloom</th>
                            <th className="px-5 py-3 text-left w-1/3">{t('history.table.question')}</th>
                            <th className="px-5 py-3 text-center">{t('history.table.result')}</th>
                            <th className="px-5 py-3 text-left">{t('history.table.time')}</th>
                            <th className="px-5 py-3 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedExercises.map((ex, i) => (
                            <tr key={ex.exercise_id || i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{(currentPage - 1) * pageSize + i + 1}</td>
                                <td className="px-5 py-3 font-medium text-gray-900">{ex.concept_name}</td>
                                <td className="px-5 py-3 text-gray-500 text-xs">
                                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                                        {getBloomLabel(ex.bloom_level)}
                                    </span>
                                </td>
                                <td className="px-5 py-3 text-gray-600 truncate max-w-[280px]" title={ex.question}>
                                    {ex.question}
                                </td>
                                <td className="px-5 py-3 flex justify-center">
                                    {ex.is_correct == null ? (
                                        <span className="text-gray-300 font-medium">—</span>
                                    ) : ex.is_correct ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-200 bg-white text-gray-900">
                                            <HiCheck className="w-4 h-4" />
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-200 bg-gray-50 text-gray-400">
                                            <HiOutlineX className="w-4 h-4" />
                                        </span>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs font-mono">
                                    {formatDate(ex.timestamp, locale)}
                                </td>
                                <td className="px-5 py-3 text-center">
                                    <button 
                                        onClick={() => setSelectedExercise(ex)}
                                        className="text-gray-400 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-100"
                                        title="View Details"
                                    >
                                        <HiOutlineEye className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="py-2">
                    <Pagination 
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}

            <Modal
                isOpen={!!selectedExercise}
                onClose={() => setSelectedExercise(null)}
                title={t('history.table.exerciseDetails')}
                size="large"
            >
                {selectedExercise && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <div>
                                <span className="text-gray-500 font-medium">{t('masteryMatrix.concept')}:</span>
                                <span className="ml-2 font-semibold text-gray-900">{selectedExercise.concept_name}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 font-medium">Bloom Level:</span>
                                <span className="ml-2 font-semibold text-gray-900">{getBloomLabel(selectedExercise.bloom_level)}</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('history.table.question')}</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-800 shadow-sm">
                                <DynamicMarkdownRenderer content={selectedExercise.question} />
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Options</h4>
                            <div className="space-y-2.5">
                                {Object.entries(selectedExercise.options || {}).map(([key, value]) => {
                                    const isUserAnswer = key === selectedExercise.user_answer;
                                    const isCorrect = key === selectedExercise.correct_option;
                                    
                                    let optionClass = "p-3.5 border rounded-lg text-sm flex gap-3 items-start transition-colors";
                                    if (isCorrect) {
                                        optionClass += " border-green-200 bg-green-50/50 text-green-900";
                                    } else if (isUserAnswer && !isCorrect) {
                                        optionClass += " border-red-200 bg-red-50/50 text-red-900";
                                    } else {
                                        optionClass += " border-gray-200 bg-white text-gray-700";
                                    }

                                    return (
                                        <div key={key} className={optionClass}>
                                            <span className={"font-bold w-6 shrink-0 mt-0.5 " + (isCorrect ? "text-green-700" : isUserAnswer ? "text-red-700" : "text-gray-500")}>{key}.</span>
                                            <span className="flex-1 leading-relaxed"><DynamicMarkdownRenderer content={value} /></span>
                                            {isCorrect && (
                                                <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 mt-0.5">
                                                    <HiCheck className="w-3.5 h-3.5" />
                                                    Correct
                                                </div>
                                            )}
                                            {isUserAnswer && !isCorrect && (
                                                <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 mt-0.5">
                                                    <HiOutlineX className="w-3.5 h-3.5" />
                                                    Your Answer
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {selectedExercise.explanation && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Explanation</h4>
                                <div className="bg-blue-50 border border-blue-100 p-5 sm:p-6 rounded-lg text-sm text-blue-900 leading-relaxed shadow-sm">
                                    <DynamicMarkdownRenderer content={selectedExercise.explanation} />
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end pt-5 border-t border-gray-100">
                            <Button onClick={() => setSelectedExercise(null)} variant="outline" className="px-6">
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
