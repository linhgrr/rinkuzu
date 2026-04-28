'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  HiOutlineCloudUpload,
  HiOutlineDocumentText,
  HiOutlineArrowLeft,
} from '@/components/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AdaptiveApiError,
  checkApiHealth,
  uploadPdf,
} from '@/features/adaptive-learning/lib/api-client';
import { ADAPTIVE_ROUTES } from '@/features/adaptive-learning/lib/routes';

export default function AdaptiveLearningUpload() {
  const router = useRouter();
  const t = useTranslations('adaptiveLearning');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');

  const getFriendlyUploadError = useCallback(
    (err: unknown) => {
      if (err instanceof AdaptiveApiError) {
        if (err.code === 'unauthorized') return t('uploadPage.errors.unauthorized');
        if (err.code === 'request_aborted' || err.code === 'network_error')
          return t('uploadPage.errors.connectionInterrupted');
        if (err.code === 'temporary_unavailable') return t('uploadPage.errors.serviceUnavailable');
        if (err.code === 'conflict') return t('uploadPage.errors.conflict');
      }

      return t('uploadPage.uploadFailed');
    },
    [t],
  );

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
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
    },
    [t],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      if (!subjectName.trim()) {
        const message = t('uploadPage.subjectRequiredBeforeUpload');
        setError(message);
        return;
      }

      setIsUploading(true);
      setError(null);
      setUploadProgress(10);
      try {
        const online = await checkApiHealth();
        if (!online) {
          const message = t('uploadPage.backendOffline');
          setError(message);
          toast.error(message);
          setIsUploading(false);
          return;
        }
        setUploadProgress(30);
        const result = await uploadPdf(file, subjectName.trim());
        setUploadProgress(100);
        localStorage.setItem('al_pipeline_job_id', result.job_id);
        localStorage.setItem('al_pipeline_filename', file.name);
        localStorage.setItem('al_pipeline_subject_name', subjectName.trim());
        toast.success(t('processing.status.queuedForProcessing'));
        setTimeout(() => {
          router.push(ADAPTIVE_ROUTES.processing);
        }, 500);
      } catch (err) {
        const message = getFriendlyUploadError(err);
        setError(message);
        toast.error(message);
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [getFriendlyUploadError, router, subjectName, t],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        if (!subjectName.trim()) {
          const message = t('uploadPage.subjectRequiredBeforeSelectFile');
          setError(message);
          return;
        }
        void handleUpload(acceptedFiles[0]);
      }
    },
    [handleUpload, subjectName, t],
  );

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
          onClick={() => router.back()}
          className="text-neutral-500 hover:text-neutral-900 -ml-4 mb-6 font-medium bg-transparent"
        >
          <HiOutlineArrowLeft className="w-5 h-5 mr-2" /> {t('uploadPage.back')}
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
          <div className="flex flex-col space-y-3">
            <label htmlFor="subjectName" className="font-semibold text-neutral-900 text-base">
              {t('uploadPage.subjectName')} <span className="text-red-500">*</span>
            </label>
            <Input
              id="subjectName"
              type="text"
              placeholder={t('uploadPage.subjectNamePlaceholder')}
              value={subjectName}
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
                    <HiOutlineCloudUpload className="h-8 w-8" />
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
                  <div className="w-16 h-16 mx-auto rounded-md bg-neutral-100 border border-neutral-200 text-neutral-900 flex items-center justify-center mb-6 animate-pulse">
                    <HiOutlineDocumentText className="w-8 h-8" />
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
