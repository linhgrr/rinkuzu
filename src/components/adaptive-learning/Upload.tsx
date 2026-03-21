'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Button } from '@/components/ui/Button';
import {
    HiOutlineCloudUpload,
    HiOutlineDocumentText,
    HiOutlineArrowLeft,
} from '@/components/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveApiError, checkApiHealth, uploadPdf } from './api-client';
import { ADAPTIVE_ROUTES } from './routes';

export default function AdaptiveLearningUpload() {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [subjectName, setSubjectName] = useState('');

    const getFriendlyUploadError = useCallback((err: unknown) => {
        if (err instanceof AdaptiveApiError) {
            if (err.code === 'unauthorized')
                return t('uploadPage.errors.unauthorized');
            if (err.code === 'request_aborted' || err.code === 'network_error')
                return t('uploadPage.errors.connectionInterrupted');
            if (err.code === 'temporary_unavailable')
                return t('uploadPage.errors.serviceUnavailable');
            if (err.code === 'conflict')
                return t('uploadPage.errors.conflict');
            if (err.detail?.trim())
                return err.detail;
        }

        return t('uploadPage.uploadFailed');
    }, [t]);

    const onDropRejected = useCallback((rejections: FileRejection[]) => {
        const firstError = rejections[0]?.errors[0];
        if (!firstError) {
            setError(t('uploadPage.uploadFailed'));
            return;
        }

        if (firstError.code === 'file-too-large') {
            setError(t('uploadPage.errors.fileTooLarge', { maxSizeMb: 50 }));
            return;
        }

        if (firstError.code === 'file-invalid-type') {
            setError(t('uploadPage.errors.onlyPdf'));
            return;
        }

        setError(firstError.message || t('uploadPage.uploadFailed'));
    }, [t]);

    const handleUpload = useCallback(async (file: File) => {
        if (!subjectName.trim()) {
            setError(t('uploadPage.subjectRequiredBeforeUpload'));
            return;
        }

        setIsUploading(true);
        setError(null);
        setUploadProgress(10);
        try {
            const online = await checkApiHealth();
            if (!online) {
                setError(t('uploadPage.backendOffline'));
                setIsUploading(false);
                return;
            }
            setUploadProgress(30);
            const result = await uploadPdf(file, subjectName.trim());
            setUploadProgress(100);
            localStorage.setItem('al_pipeline_job_id', result.job_id);
            localStorage.setItem('al_pipeline_filename', file.name);
            localStorage.setItem('al_pipeline_subject_name', subjectName.trim());
            setTimeout(() => {
                router.push(ADAPTIVE_ROUTES.processing);
            }, 500);
        } catch (err) {
            setError(getFriendlyUploadError(err));
            setIsUploading(false);
            setUploadProgress(0);
        }
    }, [getFriendlyUploadError, router, subjectName, t]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            void handleUpload(acceptedFiles[0]);
        }
    }, [handleUpload]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        onDropRejected,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        maxSize: 50 * 1024 * 1024,
        noClick: true,
    });

    const handleOpenFileDialog = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!subjectName.trim()) {
            setError(t('uploadPage.subjectRequiredBeforeSelectFile'));
            return;
        }
        open();
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-12 md:pl-4">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="text-slate-500 hover:text-slate-900 -ml-4 mb-6 font-medium bg-transparent"
                >
                    <HiOutlineArrowLeft className="w-5 h-5 mr-2" /> {t('uploadPage.back')}
                </Button>
                <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-slate-900 mb-3">{t('uploadPage.startLearning')}</h1>
                <p className="text-slate-500 text-base md:text-lg leading-relaxed max-w-2xl">
                    {t('uploadPage.description')}
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 mb-6 text-sm">
                    {error}
                </div>
            )}

            <div className="max-w-3xl mx-auto space-y-10">
                <div className="space-y-5">
                    <div className="flex flex-col space-y-3">
                        <label htmlFor="subjectName" className="font-semibold text-slate-900 text-base">
                            {t('uploadPage.subjectName')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="subjectName"
                            type="text"
                            placeholder={t('uploadPage.subjectNamePlaceholder')}
                            value={subjectName}
                            onChange={(e) => setSubjectName(e.target.value)}
                            className="px-4 py-3 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none w-full bg-slate-50 hover:bg-white transition-all font-medium"
                            disabled={isUploading}
                        />
                        {error && !subjectName.trim() && (
                            <p className="text-sm text-red-500 font-medium">{t('uploadPage.subjectRequired')}</p>
                        )}
                    </div>

                    <div
                        {...getRootProps()}
                        className={`relative group rounded-lg border border-dashed transition-all duration-200 overflow-hidden
                            ${isDragActive ? 'border-slate-900 bg-slate-100 cursor-copy' : 'border-slate-300 bg-slate-50 hover:border-slate-500 cursor-pointer'}
                            ${isUploading ? 'pointer-events-none' : ''}`}
                    >
                        <input {...getInputProps()} />

                        <div className="p-16 md:p-20 flex flex-col items-center justify-center text-center">
                            {!isUploading ? (
                                <>
                                    <div className={`w-16 h-16 rounded-md flex items-center justify-center mb-6 transition-transform duration-200 group-hover:scale-105 border ${isDragActive ? 'bg-slate-200 text-slate-900 border-slate-300' : 'bg-white text-slate-500 border-slate-200 group-hover:text-slate-900'
                                        }`}>
                                        <HiOutlineCloudUpload className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-xl font-medium tracking-tight text-slate-900 mb-2">
                                        {isDragActive ? t('dropPdfHere') : t('dragDropPdf')}
                                    </h3>
                                    <p className="text-slate-500 mb-6 text-sm">
                                        {t('uploadPage.uploadMaterialDescription')}
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="rounded-md px-6 py-4 border-slate-200 font-medium text-sm hover:bg-slate-50 hover:text-slate-900 transition-all"
                                        onClick={handleOpenFileDialog}
                                    >
                                        {t('browseFiles')}
                                    </Button>
                                </>
                            ) : (
                                <div className="w-full max-w-sm">
                                    <div className="w-16 h-16 mx-auto rounded-md bg-slate-100 border border-slate-200 text-slate-900 flex items-center justify-center mb-6 animate-pulse">
                                        <HiOutlineDocumentText className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-medium tracking-tight text-slate-900 mb-3">{t('uploadPage.uploading')}</h3>
                                    <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2.5 px-1 tracking-widest uppercase">
                                        <span>{t('uploadingFile')}</span>
                                        <span className="tabular-nums font-bold text-slate-900">{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-slate-900 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
