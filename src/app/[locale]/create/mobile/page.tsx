'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDraftStore } from '@/store/useDraftStore';
import {
  HiOutlineUpload,
  HiOutlineDocumentText,
  HiOutlineArrowRight,
  HiOutlineDesktopComputer,
  HiOutlineX,
  HiOutlineTag,
} from '@/components/icons';
import { toast } from 'sonner';
import { CategorySelector } from '@/components/ui/CategorySelector';
import { Textarea } from '@/components/ui/Input';

export default function MobileCreatePage() {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { addDraft } = useDraftStore();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      const f = acceptedFiles[0];
      setFile(f);
      setTitle(f.name.replace(/\.pdf$/i, ''));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: isUploading,
  });

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;

    setIsUploading(true);

    try {
      const { s3Key } = await uploadPdfViaPresignedUrl(file);
      const detectedTotalPages = await getPdfPageCount(file);

      // Create draft via API
      const response = await fetch('/api/draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category: selectedCategory?._id,
          s3Key,
          fileName: file.name,
          fileSize: file.size,
          totalPages: detectedTotalPages,
          prompt: aiPrompt.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create draft');
      }

      const { draftId, chunks, totalPages, expiresAt } = await response.json();

      // Add to store
      addDraft({
        id: draftId,
        title: title.trim(),
        status: 'processing',
        chunksTotal: chunks.total,
        chunksProcessed: 0,
        chunksError: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt,
      });

      toast.success(t('processingStarted'), {
        description: t('pagesChunks', { pages: totalPages, chunks: chunks.total }),
      });

      // Navigate away first, then DraftSyncProvider will resume processing
      // This prevents the abort that happens when this component unmounts
      router.push('/dashboard');

    } catch (error: any) {
      toast.error(tCommon('error'), { description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('createQuiz')}</h1>
        <p className="text-gray-500 mt-1">{t('uploadDescription')}</p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          relative rounded-2xl border-2 border-dashed p-8
          flex flex-col items-center justify-center
          min-h-[200px] transition-all duration-200 cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
          ${file ? 'border-green-500 bg-green-50' : ''}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />

        {file ? (
          <div className="text-center">
            <HiOutlineDocumentText className="w-14 h-14 text-green-500 mx-auto" />
            <p className="mt-3 font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setTitle('');
                setAiPrompt('');
              }}
              className="mt-3 inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
            >
              <HiOutlineX className="w-4 h-4" />
              {t('remove')}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <HiOutlineUpload className="w-14 h-14 text-gray-400 mx-auto" />
            <p className="mt-3 font-medium text-gray-700">
              {isDragActive ? t('dropPDFHere') : t('clickToUpload')}
            </p>
            <p className="text-sm text-gray-500">{t('supportedFormats')}</p>
          </div>
        )}
      </div>

      {/* Title Input */}
      {file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('quizTitle')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('enterTitle')}
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200
                         bg-white text-gray-900 placeholder-gray-400
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-200"
            disabled={isUploading}
          />
        </div>
      )}

      {/* Description Input */}
      {file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('descriptionOptional')}
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('provideContext')}
            rows={3}
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200
                         bg-white text-gray-900 placeholder-gray-400
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-200"
            disabled={isUploading}
          />
        </div>
      )}

      {/* Category Selector */}
      {file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('category')}
          </label>
          <CategorySelector
            value={selectedCategory}
            onChange={setSelectedCategory}
            placeholder={t('searchSelectCategory')}
            required
            disabled={isUploading}
          />
        </div>
      )}

      {/* AI Prompt Input */}
      {file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('aiPromptLabel')}
          </label>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={t('aiPromptPlaceholder')}
            rows={3}
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200
                         bg-white text-gray-900 placeholder-gray-400
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-200"
            disabled={isUploading}
          />
          <p className="text-xs text-gray-500 mt-2">
            {t('aiPromptHelper')}
          </p>
        </div>
      )}

      {/* Submit Button */}
      {file && title.trim() && selectedCategory && (
        <button
          onClick={handleSubmit}
          disabled={isUploading}
          className="w-full mt-6 py-4 rounded-full bg-blue-500 text-white
                       font-semibold flex items-center justify-center gap-2
                       hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50
                       transition-all duration-200"
        >
          {isUploading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('creatingDraft')}
            </>
          ) : (
            <>
              {t('createQuiz')}
              <HiOutlineArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      )}

      {/* Desktop Hint */}
      <div className="mt-8 p-4 rounded-xl bg-gray-100 flex items-start gap-3">
        <HiOutlineDesktopComputer className="w-6 h-6 text-gray-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-700">{t('editTitleDescription')}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('reviewQuestions')}
          </p>
        </div>
      </div>
    </div>
  );
}

async function uploadPdfViaPresignedUrl(file: File): Promise<{ s3Key: string }> {
  const response = await fetch('/api/storage/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/pdf',
      fileSize: file.size,
      purpose: 'quiz',
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.success || !payload?.data?.uploadUrl || !payload?.data?.s3Key) {
    throw new Error(payload?.error || 'Failed to create upload URL');
  }

  const putResponse = await fetch(payload.data.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error(`Storage upload failed with status ${putResponse.status}`);
  }

  return { s3Key: payload.data.s3Key as string };
}

async function getPdfPageCount(file: File): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    return pdf.getPageCount();
  } catch {
    return 1;
  }
}
