'use client';

import { useRouter } from '@/i18n/navigation';
import React, { useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  HiOutlineArrowLeft,
  HiOutlineCloudUpload,
  HiOutlineDocumentText,
  HiOutlineRefresh,
  HiOutlineX,
} from 'react-icons/hi';
import { useTranslations } from 'next-intl';
import {
  AdaptiveApiError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
} from '@/features/adaptive/lib/adaptive-api-error';
import {
  checkApiReadiness,
  uploadPdf,
  type ApiReadinessCause,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { saveSelectedPipelineJob } from '@/features/adaptive/lib/session-storage';
import { captureAnalyticsEvent, fileSizeBucket } from '@/lib/analytics/client';
import { getPdfPageCount } from '@/lib/pdf';
import { MAX_PDF_UPLOAD_MB } from '@/lib/pdf-upload-policy';
import { usePdfUploadPolicy } from '@/hooks/usePdfUploadPolicy';

const DEFAULT_PIPELINE_PAGE_BATCH_SIZE = 10;
const HEALTH_RETRY_DELAY_MS = 1_000;
// Session and readiness failures will not clear in a second; only blips are retried.
const TRANSIENT_HEALTH_CAUSES: ReadonlySet<ApiReadinessCause> = new Set([
  'upstream_error',
  'timeout',
  'network',
]);

export default function AdaptiveLearningUpload() {
  const { back, push } = useRouter();
  const t = useTranslations('adaptiveLearning');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const uploadPolicy = usePdfUploadPolicy('adaptive');

  const getFriendlyUploadError = (err: unknown) => {
    if (err instanceof AdaptiveApiError) {
      if (err.code === 'unauthorized') return t('uploadPage.errors.unauthorized');
      if (isAdaptiveRequestAbortedError(err)) return t('uploadPage.errors.connectionInterrupted');
      if (isAdaptiveServiceUnavailableError(err)) return t('uploadPage.errors.serviceUnavailable');
      if (err.code === 'conflict') return t('uploadPage.errors.conflict');
      if (err.code === 'validation_error') {
        const validationDetail = `${err.detail ?? ''} ${err.message}`.toLowerCase();
        if (validationDetail.includes('page')) {
          return t('uploadPage.errors.pageLimitExceeded', { maxPages: uploadPolicy.maxPages });
        }
        if (
          validationDetail.includes('readable') ||
          validationDetail.includes('valid pdf') ||
          validationDetail.includes('encrypted')
        ) {
          return t('uploadPage.errors.pdfUnreadable');
        }
      }
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
      const message = t('uploadPage.errors.fileTooLarge', { maxSizeMb: MAX_PDF_UPLOAD_MB });
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
    const normalizedSubjectName = subjectName.trim();
    if (!normalizedSubjectName) {
      const message = t('uploadPage.subjectRequiredBeforeUpload');
      setSubjectError(message);
      return;
    }

    setIsUploading(true);
    setError(null);
    setSubjectError(null);
    setUploadProgress(10);
    const uploadStartedAt = performance.now();
    const sizeBucket = fileSizeBucket(file.size);
    const journeyId = crypto.randomUUID();
    captureAnalyticsEvent('pdf_upload_started', {
      file_size_bucket: sizeBucket,
      journey_id: journeyId,
    });
    try {
      let readiness = await checkApiReadiness();
      if (!readiness.ok && TRANSIENT_HEALTH_CAUSES.has(readiness.cause)) {
        await new Promise((resolve) => setTimeout(resolve, HEALTH_RETRY_DELAY_MS));
        readiness = await checkApiReadiness();
      }
      if (!readiness.ok) {
        const message = t('uploadPage.backendOffline');
        captureAnalyticsEvent('pdf_upload_failed', {
          file_size_bucket: sizeBucket,
          journey_id: journeyId,
          reason: 'service_unavailable',
          health_cause: readiness.cause,
          duration_ms: Math.round(performance.now() - uploadStartedAt),
        });
        setError(message);
        toast.error(message);
        setIsUploading(false);
        return;
      }
      setUploadProgress(30);
      const result = await uploadPdf(file, normalizedSubjectName, DEFAULT_PIPELINE_PAGE_BATCH_SIZE);
      setUploadProgress(100);
      captureAnalyticsEvent('pdf_upload_completed', {
        file_size_bucket: sizeBucket,
        journey_id: journeyId,
        duration_ms: Math.round(performance.now() - uploadStartedAt),
      });
      saveSelectedPipelineJob({
        jobId: result.job_id,
        filename: file.name,
        subjectName: normalizedSubjectName,
      });
      toast.success(t('processing.status.queuedForProcessing'));
      setTimeout(() => {
        push(ADAPTIVE_ROUTES.dashboard);
      }, 500);
    } catch (err) {
      captureAnalyticsEvent('pdf_upload_failed', {
        file_size_bucket: sizeBucket,
        journey_id: journeyId,
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

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      try {
        const pageCount = await getPdfPageCount(file);
        if (pageCount > uploadPolicy.maxPages) {
          setError(
            t('uploadPage.errors.tooManyPages', {
              pages: pageCount,
              maxPages: uploadPolicy.maxPages,
            }),
          );
          return;
        }
        setSelectedFile(file);
        setError(null);
      } catch {
        setError(t('uploadPage.errors.unreadablePdf'));
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: uploadPolicy.maxBytes,
    disabled: isUploading || uploadPolicy.isLoading,
  });

  const handleOpenFileDialog = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    open();
  };

  const handleSubmit = () => {
    if (!subjectName.trim()) {
      setSubjectError(t('uploadPage.subjectRequiredBeforeUpload'));
      return;
    }
    if (!selectedFile) {
      setError(t('uploadPage.fileRequired'));
      return;
    }
    void handleUpload(selectedFile);
  };

  const selectedFileSize = selectedFile
    ? `${(selectedFile.size / (1024 * 1024)).toFixed(selectedFile.size >= 1024 * 1024 ? 1 : 2)} MB`
    : null;

  return (
    <div className="mx-auto max-w-4xl font-home text-ink">
      {/* Header */}
      <div className="mb-12 md:pl-4">
        <Button
          variant="ghost"
          onClick={() => back()}
          className="text-neutral-500 hover:text-neutral-900 -ml-4 mb-6 font-medium bg-transparent"
        >
          <HiOutlineArrowLeft className="size-5 mr-2" /> {t('uploadPage.back')}
        </Button>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          {t('uploadPage.startLearning')}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted md:text-lg">
          {t('uploadPage.description')}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
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
              onChange={(event) => {
                setSubjectName(event.target.value);
                if (event.target.value.trim()) setSubjectError(null);
              }}
              aria-invalid={Boolean(subjectError)}
              aria-describedby={subjectError ? 'subject-name-error' : undefined}
              className="w-full bg-surface-warm text-sm font-medium hover:bg-white"
              disabled={isUploading}
            />
            {subjectError && (
              <p id="subject-name-error" role="alert" className="text-sm font-medium text-red-600">
                {subjectError}
              </p>
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
              {!isUploading && !selectedFile ? (
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
                    {t('uploadPage.pdfLimitHint', { maxPages: uploadPolicy.maxPages })}
                    <span className="mt-1 block text-xs text-neutral-400">
                      {t('uploadPage.pdfTechnicalLimit', { maxSizeMb: MAX_PDF_UPLOAD_MB })}
                    </span>
                  </p>
                  <Button
                    variant="primary"
                    className="px-6 text-sm font-medium"
                    onClick={handleOpenFileDialog}
                  >
                    {t('browseFiles')}
                  </Button>
                </>
              ) : !isUploading && selectedFile ? (
                <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
                  <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-xl border border-accent-warm bg-white text-accent">
                    <HiOutlineDocumentText className="size-8" aria-hidden="true" />
                  </div>
                  <h3 className="break-words text-lg font-semibold text-ink">
                    {selectedFile.name}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">{selectedFileSize}</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Button variant="secondary" onClick={handleOpenFileDialog} className="gap-2">
                      <HiOutlineRefresh className="size-4" aria-hidden="true" />
                      {t('uploadPage.replaceFile')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedFile(null);
                        setError(null);
                      }}
                      className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <HiOutlineX className="size-4" aria-hidden="true" />
                      {t('uploadPage.removeFile')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-sm">
                  <div className="size-16 mx-auto rounded-md bg-neutral-100 border border-line text-neutral-900 flex items-center justify-center mb-6 animate-pulse">
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
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={isUploading || !selectedFile}
              className="min-h-12 w-full rounded-full px-7 font-semibold sm:w-auto"
            >
              {isUploading ? t('uploadPage.uploading') : t('uploadPage.createLearningPath')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
