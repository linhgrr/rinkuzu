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
} from '@/components/icons';
import { toast } from 'sonner';
import { CategorySelector } from '@/features/categories/components/CategorySelector';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { fetchApiData } from '@/lib/api/client';
import { getPdfPageCount, uploadPdfViaPresignedUrl } from '@/lib/pdf';

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
      const data = await fetchApiData<{
        draftId: string;
        chunks: { total: number };
        totalPages: number;
        expiresAt: string;
      }>('/api/draft/create', {
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

      // Add to store
      addDraft({
        id: data.draftId,
        title: title.trim(),
        status: 'processing',
        chunksTotal: data.chunks.total,
        chunksProcessed: 0,
        chunksError: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
        expiresAt: data.expiresAt,
      });

      toast.success(t('processingStarted'), {
        description: t('pagesChunks', { pages: data.totalPages, chunks: data.chunks.total }),
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
    <div className="min-h-screen bg-neutral-50 px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">{t('createQuiz')}</h1>
        <p className="text-neutral-500 mt-1">{t('uploadDescription')}</p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          relative rounded-2xl border-2 border-dashed p-8
          flex flex-col items-center justify-center
          min-h-[200px] cursor-pointer transition-[background-color,border-color] duration-200
          ${isDragActive ? 'border-green-500 bg-green-50' : 'border-neutral-200 bg-white'}
          ${file ? 'border-green-500 bg-green-50' : ''}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />

        {file ? (
          <div className="text-center">
            <HiOutlineDocumentText className="w-14 h-14 text-green-500 mx-auto" />
            <p className="mt-3 font-medium text-neutral-900">{file.name}</p>
            <p className="text-sm text-neutral-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setTitle('');
                setAiPrompt('');
              }}
              className="mt-3 px-3 text-sm text-red-500 hover:text-red-600"
            >
              <HiOutlineX className="w-4 h-4" />
              {t('remove')}
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <HiOutlineUpload className="w-14 h-14 text-neutral-400 mx-auto" />
            <p className="mt-3 font-medium text-neutral-700">
              {isDragActive ? t('dropPDFHere') : t('clickToUpload')}
            </p>
            <p className="text-sm text-neutral-500">{t('supportedFormats')}</p>
          </div>
        )}
      </div>

      {/* Title Input */}
      {file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {t('quizTitle')}
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('enterTitle')}
            className="h-[52px] rounded-xl px-4"
            disabled={isUploading}
          />
        </div>
      )}

      {/* Description Input */}
      {file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {t('descriptionOptional')}
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('provideContext')}
            rows={3}
            className="rounded-xl px-4 py-3"
            disabled={isUploading}
          />
        </div>
      )}

      {/* Category Selector */}
      {file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">{t('category')}</label>
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
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {t('aiPromptLabel')}
          </label>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={t('aiPromptPlaceholder')}
            rows={3}
            className="rounded-xl px-4 py-3"
            disabled={isUploading}
          />
          <p className="text-xs text-neutral-500 mt-2">{t('aiPromptHelper')}</p>
        </div>
      )}

      {/* Submit Button */}
      {file && title.trim() && selectedCategory && (
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isUploading}
          size="lg"
          className="mt-6 w-full rounded-full bg-green-500 hover:bg-brand-trust"
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
        </Button>
      )}

      {/* Desktop Hint */}
      <div className="mt-8 p-4 rounded-xl bg-neutral-100 flex items-start gap-3">
        <HiOutlineDesktopComputer className="w-6 h-6 text-neutral-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-neutral-700">{t('editTitleDescription')}</p>
          <p className="text-sm text-neutral-500 mt-0.5">{t('reviewQuestions')}</p>
        </div>
      </div>
    </div>
  );
}
