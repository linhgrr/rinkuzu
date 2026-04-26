import React, { memo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FiClock, FiTrash2, FiChevronRight } from 'react-icons/fi';
import {
    FcDocument,
    FcFile,
    FcFolder,
    FcIdea,
    FcLibrary,
    FcMindMap,
    FcNews,
    FcOpenedFolder,
    FcReading,
    FcReadingEbook,
    FcPuzzle
} from 'react-icons/fc';
import type { PipelineJobHistoryItem } from './types';

const FC_ICONS = [
    FcReadingEbook,
    FcDocument,
    FcIdea,
    FcMindMap,
    FcNews,
    FcLibrary,
    FcReading,
    FcOpenedFolder,
    FcPuzzle,
    FcFolder
];

export interface SubjectCardProps {
    job: PipelineJobHistoryItem;
    onOpen: (jobId: string) => void;
    onDelete: (job: PipelineJobHistoryItem) => void;
    loading?: boolean;
    deleting?: boolean;
    index?: number;
}

export const SubjectCard = memo(function SubjectCard({ job, onOpen, onDelete, loading, deleting, index = 0 }: SubjectCardProps) {
    const displayName = job.filename
        ? job.filename.replace(/\.[^.]+$/, '')
        : job.subject_id || job.job_id;

    const t = useTranslations('adaptiveLearning');
    const locale = useLocale();

    const completedAt = job.completed_at
        ? new Date(job.completed_at * 1000).toLocaleDateString(locale)
        : '—';

    // Determine icon based on file type or use a random one from FC_ICONS
    let IconComponent = FC_ICONS[index % FC_ICONS.length];

    if (job.filename) {
        const lowerName = job.filename.toLowerCase();
        if (lowerName.endsWith('.pdf')) {
            IconComponent = FcDocument;
        } else if (lowerName.match(/\.(doc|docx)$/)) {
            IconComponent = FcFile;
        } else if (lowerName.match(/\.(ppt|pptx)$/)) {
            IconComponent = FcMindMap;
        }
    }

    return (
        <div
            className="group w-full overflow-hidden rounded-2xl bg-white border border-neutral-200/80 shadow-sm hover:border-brand-trust/40 hover:shadow-[var(--shadow-green-glow)] transition-all duration-300 flex flex-row items-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-trust bg-gradient-to-r from-white to-neutral-50/30 mb-3"
            onClick={() => onOpen(job.job_id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(job.job_id); }}
        >
            <div className="flex flex-row items-center flex-1 p-4 gap-4 relative z-10 w-full min-w-0">
                {/* Icon */}
                <div className="shrink-0">
                    <div className="inline-flex rounded-xl p-3 bg-white/50 group-hover:bg-white transition-all duration-300 border border-neutral-200/60 shadow-sm group-hover:shadow-md group-hover:scale-105">
                        <IconComponent className="h-6 w-6" aria-hidden="true" />
                    </div>
                </div>

                {/* Titles */}
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <h3 className="font-bold text-neutral-900 text-base md:text-lg tracking-tight leading-tight truncate group-hover:text-black transition-colors" title={job.subject_id || displayName}>
                        {job.subject_id || displayName}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 w-full opacity-70 min-w-0">
                        {job.subject_id && job.filename && (
                            <p className="text-[11px] font-medium text-neutral-600 truncate" title={job.filename}>
                                {job.filename}
                            </p>
                        )}
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap shrink-0">
                            <FiClock className="w-3 h-3" aria-hidden="true" />
                            {completedAt}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2 pl-4 border-l border-neutral-100 h-full">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(job); }}
                        disabled={loading || deleting}
                        className="p-3 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title={t('dashboard.deleteMaterial')}
                        aria-label={t('dashboard.deleteMaterial')}
                    >
                        {deleting ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                    </button>
                    <div className="hidden sm:flex text-neutral-300 group-hover:text-neutral-900 group-hover:translate-x-1 transition-all duration-300 mr-2">
                        <FiChevronRight className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {loading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-20">
                    <div className="flex flex-col items-center gap-3">
                        <svg className="animate-spin h-6 w-6 text-neutral-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                </div>
            )}
        </div>
    );
});