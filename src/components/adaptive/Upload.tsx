'use client';

import { useRouter } from '@/i18n/navigation';
import React, { useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HiOutlineCloudUpload, HiOutlineDocumentText, HiOutlineArrowLeft } from 'react-icons/hi';
import { useTranslations } from 'next-intl';
import {
  AdaptiveApiError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
} from '@/features/adaptive/lib/adaptive-api-error';
import { checkApiHealth, uploadPdf } from '@/features/adaptive/lib/adaptive-api-methods';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { saveSelectedPipelineJob } from '@/features/adaptive/lib/session-storage';
import { captureAnalyticsEvent, fileSizeBucket } from '@/lib/analytics/client';

const DEFAULT_PIPELINE_PAGE_BATCH_SIZE = 10;

export default function AdaptiveLearningUpload() {
  const { back, push } = useRouter();
  const t = useTranslations('adaptiveLearning');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');

  const getFriendlyUploadError = (err: unknown) => {
    if (err instanceof AdaptiveApiError) {
      if (err.code === 'unauthorized') return t('uploadPage.errors.unauthorized');
      if (isAdaptiveRequestAbortedError(err)) return t('uploadPage.errors.connectionInterrupted');
      if (isAdaptiveServiceUnavailableError(err)) return t('uploadPage.errors.serviceUnavailable');
      if (err.code === 'conflict') return t('uploadPage.errors.conflict');
    }

    return t('uploadPage.uploadFailed');
  };

  const onDropRejected = (rejections: FileRejection[]) => {
    const firstError = rejections[0]?.errors[0];
    if (!firstError) {
      const message = t('uploadPage.uploadFailed');
      setError(message);
      return;
    }

    if (firstError.code === 'file-too-large') {
      const message = t('uploadPage.errors.fileTooLarge', { maxSizeMb: 50 });
      setError(message);
      return;
    }

    if (firstError.code === 'file-invalid-type') {
      const message = t('uploadPage.errors.onlyPdf');
      setError(message);
      return;
    }

    const message = firstError.message || t('uploadPage.uploadFailed');
    setError(message);
  };

  const handleUpload = async (file: File) => {
    if (!subjectName.trim()) {
      const message = t('uploadPage.subjectRequiredBeforeUpload');
      setError(message);
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(10);
    const uploadStartedAt = performance.now();
    const sizeBucket = fileSizeBucket(file.size);
    captureAnalyticsEvent('pdf_upload_started', { file_size_bucket: sizeBucket });
    try {
      const online = await checkApiHealth();
      if (!online) {
        const message = t('uploadPage.backendOffline');
        captureAnalyticsEvent('pdf_upload_failed', {
          file_size_bucket: sizeBucket,
          reason: 'service_unavailable',
          duration_ms: Math.round(performance.now() - uploadStartedAt),
        });
        setError(message);
        toast.error(message);
        setIsUploading(false);
        return;
      }
      setUploadProgress(30);
      const result = await uploadPdf(file, subjectName.trim(), DEFAULT_PIPELINE_PAGE_BATCH_SIZE);
      setUploadProgress(100);
      captureAnalyticsEvent('pdf_upload_completed', {
        file_size_bucket: sizeBucket,
        duration_ms: Math.round(performance.now() - uploadStartedAt),
      });
      saveSelectedPipelineJob({
        jobId: result.job_id,
        filename: file.name,
        subjectName: subjectName.trim(),
      });
      toast.success(t('processing.status.queuedForProcessing'));
      setTimeout(() => {
        push(ADAPTIVE_ROUTES.dashboard);
      }, 500);
    } catch (err) {
      captureAnalyticsEvent('pdf_upload_failed', {
        file_size_bucket: sizeBucket,
        reason: err instanceof AdaptiveApiError ? err.code : 'unknown',
        duration_ms: Math.round(performance.now() - uploadStartedAt),
      });
      const message = getFriendlyUploadError(err);
      setError(message);
      toast.error(message);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (!subjectName.trim()) {
        const message = t('uploadPage.subjectRequiredBeforeSelectFile');
        setError(message);
        return;
      }
      void handleUpload(file);
    }
  };

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
      const message = t('uploadPage.subjectRequiredBeforeSelectFile');
      setError(message);
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
          onClick={() => back()}
          className="text-neutral-500 hover:text-neutral-900 -ml-4 mb-6 font-medium bg-transparent"
        >
          <HiOutlineArrowLeft className="size-5 mr-2" /> {t('uploadPage.back')}
        </Button>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-neutral-900 mb-3">
          {t('uploadPage.startLearning')}
        </h1>
        <p className="text-neutral-500 text-base md:text-lg leading-relaxed max-w-2xl">
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
          <div className="flex flex-col gap-y-3">
            <label htmlFor="subjectName" className="font-semibold text-neutral-900 text-base">
              {t('uploadPage.subjectName')} <span className="text-red-500">*</span>
            </label>
            <Input
              id="subjectName"
              type="text"
              placeholder={t('uploadPage.subjectNamePlaceholder')}
              value={subjectName}
              maxLength={120}
              onChange={(e) => setSubjectName(e.target.value)}
              className="w-full bg-neutral-50 text-sm font-medium hover:bg-white"
              disabled={isUploading}
            />
            {error && !subjectName.trim() && (
              <p className="text-sm text-red-500 font-medium">{t('uploadPage.subjectRequired')}</p>
            )}
          </div>

          <div
            {...getRootProps()}
            className={`upload-dropzone relative group cursor-pointer transition-colors duration-200 overflow-hidden
                            ${isDragActive ? '!border-brand-action bg-orange-50/30 cursor-copy' : ''}
                            ${isUploading ? 'pointer-events-none' : ''}`}
          >
            <input {...getInputProps()} />

            <div className="p-16 md:p-20 flex flex-col items-center justify-center text-center">
              {!isUploading ? (
                <>
                  <div
                    className={`w-16 h-16 rounded-md flex items-center justify-center mb-6 transition-transform duration-200 group-hover:scale-105 border ${
                      isDragActive
                        ? 'bg-orange-100 text-brand-action border-brand-action/30'
                        : 'bg-white text-brand-action border-orange-200 group-hover:text-brand-action-hover'
                    }`}
                  >
                    <HiOutlineCloudUpload className="size-8" />
                  </div>
                  <h3 className="text-xl font-medium tracking-tight text-neutral-900 mb-2">
                    {isDragActive ? t('dropPdfHere') : t('dragDropPdf')}
                  </h3>
                  <p className="text-neutral-500 mb-6 text-sm">
                    {t('uploadPage.uploadMaterialDescription')}
                  </p>
                  <Button
                    variant="primary"
                    className="px-6 text-sm font-medium"
                    onClick={handleOpenFileDialog}
                  >
                    {t('browseFiles')}
                  </Button>
                </>
              ) : (
                <div className="w-full max-w-sm">
                  <div className="size-16 mx-auto rounded-md bg-neutral-100 border border-neutral-200 text-neutral-900 flex items-center justify-center mb-6 animate-pulse">
                    <HiOutlineDocumentText className="size-8" />
                  </div>
                  <h3 className="text-lg font-medium tracking-tight text-neutral-900 mb-3">
                    {t('uploadPage.uploading')}
                  </h3>
                  <div className="flex items-center justify-between text-xs font-medium text-neutral-500 mb-2.5 px-1 tracking-widest uppercase">
                    <span>{t('uploadingFile')}</span>
                    <span className="tabular-nums font-bold text-neutral-900">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand-trust h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
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
