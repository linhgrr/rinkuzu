'use client';

import React, { memo, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import { useTranslations, useLocale } from 'next-intl';
import {
    HiOutlineCloudUpload,
    HiOutlineAcademicCap,
    HiArrowRight,
    HiOutlineBookOpen,
    HiOutlineLightningBolt,
    HiOutlineChip,
    HiOutlineCollection,
    HiOutlineLink,
    HiOutlineCalendar,
    HiOutlineCheckCircle,
    HiOutlineSearch,
    HiOutlineTrash,
} from '@/components/icons';
import { checkApiHealth, createSessionFromPipeline, deleteSubject } from './api-client';
import type { PipelineJobHistoryItem } from './types';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useSubjects } from '@/hooks/useAdaptiveLearning';

// ─── Subject Card ─────────────────────────────────────────────────────────────

interface SubjectCardProps {
    job: PipelineJobHistoryItem;
    onOpen: (jobId: string) => void;
    onDelete: (job: PipelineJobHistoryItem) => void;
    loading?: boolean;
    deleting?: boolean;
}

const SubjectCard = memo(function SubjectCard({ job, onOpen, onDelete, loading, deleting }: SubjectCardProps) {
    const displayName = job.filename
        ? job.filename.replace(/\.[^.]+$/, '')
        : job.subject_id || job.job_id;

    const t = useTranslations('adaptiveLearning');
    const locale = useLocale();

    const completedAt = job.completed_at
        ? new Date(job.completed_at * 1000).toLocaleDateString(locale)
        : '—';

    return (
        <div className="group relative overflow-hidden rounded-lg bg-white border border-gray-200 hover:border-gray-800 transition-colors duration-200 flex flex-col cursor-pointer">


            <div className="flex flex-col flex-1 p-6 gap-5">
                {/* Icon + title */}
                <div className="flex items-start gap-4">
                    <div className="rounded-md bg-gray-100 p-2.5 text-gray-900 shrink-0 group-hover:bg-gray-200 transition-colors duration-200">
                        <HiOutlineBookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        {job.subject_id && (
                            <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-2" title={job.subject_id}>
                                {job.subject_id}
                            </h3>
                        )}

                        <p className="text-xs text-gray-400 mt-1 truncate font-mono">{displayName}</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-gray-50 px-3 py-2 border border-gray-100">
                        <div className="text-xl font-mono font-medium text-gray-900">{job.concepts_after_merge ?? '—'}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mt-1 flex items-center gap-1">
                            <HiOutlineCollection className="w-3 h-3" />
                            {t('conceptDetail.bloomBreakdown').split(' ')[0]}
                        </div>
                    </div>
                    <div className="rounded-md bg-gray-50 px-3 py-2 border border-gray-100">
                        <div className="text-xl font-mono font-medium text-gray-900">{job.relations_verified ?? '—'}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mt-1 flex items-center gap-1">
                            <HiOutlineLink className="w-3 h-3" />
                            {t('processing.stats.relations')}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                    <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                        <HiOutlineCalendar className="w-3 h-3" />
                        {completedAt}
                    </span>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 flex items-center gap-1">
                        <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                        {t('processing.status.completed')}
                    </span>
                </div>
            </div>

            {/* CTA */}
            <div className="px-5 pb-5 flex gap-2">
                <Button
                    onClick={() => onOpen(job.job_id)}
                    disabled={loading || deleting}
                    className="flex-1 rounded-md bg-black hover:bg-gray-800 text-white font-medium min-h-[44px] h-11 text-sm gap-2 disabled:opacity-50 transition-colors"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {t('dashboard.creatingSession')}
                        </>
                    ) : (
                        <>
                            {t('dashboard.startLearning')}
                            <HiArrowRight className="h-4 w-4" />
                        </>
                    )}
                </Button>
                <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onDelete(job); }}
                    disabled={loading || deleting}
                    className="min-h-[44px] h-11 w-11 p-0 rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                    title="Xóa tài liệu"
                    aria-label={`Xóa tài liệu ${displayName}`}
                >
                    {deleting ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : (
                        <HiOutlineTrash className="h-5 w-5" />
                    )}
                </Button>
            </div>
        </div>
    );
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptySubjects({ onUpload }: { onUpload: () => void }) {
    const t = useTranslations('adaptiveLearning');
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-20 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-md bg-white border border-gray-200 text-gray-900">
                <HiOutlineCloudUpload className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">{t('dashboard.noMaterials')}</h3>
            <p className="mb-8 max-w-md text-sm text-gray-500 leading-relaxed">
                {t('noLearningDataDescription', { uploadPdf: '' }).replace(/\{|\}/g, '').trim()}
            </p>
            <Button
                onClick={onUpload}
                className="h-10 rounded-md bg-black hover:bg-gray-800 px-6 font-medium text-white transition-colors"
            >
                {t('dashboard.uploadMaterial')}
            </Button>
        </div>
    );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function AdaptiveLearningDashboard() {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');

    const { data: subjectsData, isLoading: loading, error: subjectsError, mutate: mutateSubjects } = useSubjects();
    const subjects = subjectsData || [];
    const error = subjectsError ? String(subjectsError) : null;
    const [apiOnline, setApiOnline] = useState<boolean | null>(null);
    const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
    const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<PipelineJobHistoryItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let mounted = true;
        const bootstrap = async () => {
            const online = await checkApiHealth();
            if (mounted) setApiOnline(online);
        };
        void bootstrap();
        return () => { mounted = false; };
    }, []);

    const handleGoUpload = useCallback(() => {
        router.push('/adaptive-learning/upload');
    }, [router]);

    const handleOpenSubject = useCallback(async (jobId: string) => {
        if (loadingJobId || deletingJobId) return;
        setLoadingJobId(jobId);

        try {
            const session = await createSessionFromPipeline(jobId, 50);
            localStorage.setItem('al_session_id', session.session_id);
            router.push(`/adaptive-learning/subject/${session.session_id}`);
        } catch (err) {
            console.error(`Không thể tạo phiên học: ${(err as Error).message}`);
            setLoadingJobId(null);
        }
    }, [router, loadingJobId, deletingJobId]);

    const handleDeleteClick = useCallback((job: PipelineJobHistoryItem) => {
        setItemToDelete(job);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!itemToDelete || loadingJobId || deletingJobId) return;

        setDeletingJobId(itemToDelete.job_id);
        try {
            await deleteSubject(itemToDelete.job_id, true);
            void mutateSubjects();

            if (localStorage.getItem('al_pipeline_job_id') === itemToDelete.job_id) {
                localStorage.removeItem('al_pipeline_job_id');
                localStorage.removeItem('al_pipeline_filename');
                localStorage.removeItem('al_pipeline_subject_name');
            }
        } catch (err) {
            console.error(`Không thể xóa tài liệu: ${(err as Error).message}`);
        } finally {
            setDeletingJobId(null);
            setItemToDelete(null);
        }
    }, [itemToDelete, loadingJobId, deletingJobId]);

    const handleCancelDelete = useCallback(() => {
        if (!deletingJobId) {
            setItemToDelete(null);
        }
    }, [deletingJobId]);

    const filteredSubjects = subjects.filter((job) => {
        if (!searchQuery) return true;
        const displayName = job.filename?.replace(/\.[^.]+$/, '') || job.subject_id || job.job_id;
        return displayName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="space-y-8">
            {/* ── Hero Header ── */}
            <div className="relative overflow-hidden rounded-xl bg-white border border-gray-200 p-5 sm:p-8 md:p-10 mb-8 sm:mb-10 shadow-sm">
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
                    <div className="flex items-start gap-4">
                        <div className="rounded-[14px] bg-gray-50/50 border border-gray-100 p-3 sm:p-3.5 shrink-0 shadow-xs">
                            <HiOutlineAcademicCap className="w-6 h-6 sm:w-7 sm:h-7 text-[#0071e3]" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-[#1d1d1f] mb-1.5">
                                {t('dashboardTitle')}
                            </h1>
                            <p className="text-[#86868b] text-sm sm:text-base leading-relaxed max-w-2xl">
                                {t('dashboardSubtitle')}
                            </p>
                            {apiOnline === false && (
                                <p className="text-xs text-red-600 mt-3 flex items-center gap-1.5 bg-red-50 rounded-md px-3 py-1.5 w-fit font-bold tracking-widest uppercase border border-red-100">
                                    <HiOutlineChip className="w-3.5 h-3.5" />
                                    {t('backendOffline')}
                                </p>
                            )}
                        </div>
                    </div>
                    <Button
                        onClick={handleGoUpload}
                        className="rounded-full bg-[#0071e3] text-white hover:bg-[#0077ED] px-6 min-h-[44px] h-11 font-medium text-sm transition-all sm:hover:scale-105 active:scale-95 shadow-sm hover:shadow-md shrink-0 w-full md:w-auto"
                    >
                        {t('dashboard.uploadMaterial')}
                    </Button>
                </div>

                {/* Quick stats */}
                {!loading && subjects.length > 0 && (
                    <div className="relative mt-8 sm:mt-10 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        <div className="rounded-xl bg-[#f5f5f7] px-4 sm:px-5 py-3.5 sm:py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineBookOpen className="w-3.5 h-3.5" />
                                {t('uploadMaterial')}
                            </div>
                            <div className="text-2xl font-mono text-gray-900">{subjects.length}</div>
                        </div>
                        <div className="rounded-md bg-gray-50 px-5 py-4 border border-gray-100">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineCollection className="w-3.5 h-3.5" />
                                {t('conceptDetail.bloomBreakdown').split(' ')[0]}
                            </div>
                            <div className="text-2xl font-mono text-gray-900">
                                {subjects.reduce((sum, s) => sum + (s.concepts_after_merge || 0), 0)}
                            </div>
                        </div>
                        <div className="rounded-md bg-gray-50 px-5 py-4 border border-gray-100 col-span-2 md:col-span-1">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineLink className="w-3.5 h-3.5" />
                                {t('dashboard.relations')}
                            </div>
                            <div className="text-2xl font-mono text-gray-900">
                                {subjects.reduce((sum, s) => sum + (s.relations_verified || 0), 0)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* ── Subjects grid ── */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-72 animate-pulse rounded-xl bg-gray-50 border border-gray-200" />
                    ))}
                </div>
            ) : subjects.length === 0 ? (
                <EmptySubjects onUpload={handleGoUpload} />
            ) : (
                <>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                            <HiOutlineLightningBolt className="w-5 h-5 text-gray-900" />
                            {t('dashboard.yourDocuments')}
                            <span className="ml-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-mono text-gray-600">
                                {subjects.length}
                            </span>
                        </h2>
                        {/* Search */}
                        <div className="relative w-full sm:w-72">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('dashboard.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-md border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                            />
                        </div>
                    </div>

                    {filteredSubjects.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <HiOutlineSearch className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">{t('dashboard.noMatchingDocuments')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredSubjects.map((job) => (
                                <SubjectCard
                                    key={job.job_id}
                                    job={job}
                                    onOpen={handleOpenSubject}
                                    onDelete={handleDeleteClick}
                                    loading={loadingJobId === job.job_id}
                                    deleting={deletingJobId === job.job_id}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={!!itemToDelete}
                title={t('dashboard.deleteDocumentTitle')}
                message={
                    <>
                        {t('dashboard.deleteConfirmDescription')}
                    </>
                }
                confirmText={t('dashboard.deleteMaterial')}
                cancelText={t('common.cancel')}
                confirmVariant="destructive"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                isLoading={!!deletingJobId}
            />
        </div>
    );
}
