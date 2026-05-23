'use client';

import { useCallback, useReducer } from 'react';
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
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { getPdfPageCount, uploadPdfViaPresignedUrl } from '@/lib/pdf';
import { useCreateResponsiveRedirect } from '@/hooks/useCreateResponsiveRedirect';

type CategoryLike = {
  _id: string;
  name: string;
  description?: string;
  color?: string;
};

type MobileCreateState = {
  file: File | null;
  title: string;
  description: string;
  selectedCategory: CategoryLike | null;
  aiPrompt: string;
  isUploading: boolean;
};

type MobileCreateAction =
  | { type: 'patch'; value: Partial<MobileCreateState> }
  | { type: 'setFile'; value: File | null };

const initialState: MobileCreateState = {
  file: null,
  title: '',
  description: '',
  selectedCategory: null,
  aiPrompt: '',
  isUploading: false,
};

function mobileCreateReducer(
  state: MobileCreateState,
  action: MobileCreateAction,
): MobileCreateState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'setFile':
      return {
        ...state,
        file: action.value,
        title: action.value ? action.value.name.replace(/\.pdf$/i, '') : '',
        aiPrompt: action.value ? state.aiPrompt : '',
      };
    default:
      return state;
  }
}

export default function MobileCreatePage() {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const { push } = useRouter();
  const { addDraft } = useDraftStore();
  const [state, dispatch] = useReducer(mobileCreateReducer, initialState);
  const isRedirecting = useCreateResponsiveRedirect('mobile');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      dispatch({ type: 'setFile', value: acceptedFiles[0] });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: state.isUploading,
  });

  const handleSubmit = async () => {
    if (!state.file || !state.title.trim()) return;

    dispatch({ type: 'patch', value: { isUploading: true } });

    try {
      const { s3Key } = await uploadPdfViaPresignedUrl(state.file);
      const detectedTotalPages = await getPdfPageCount(state.file);

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
          title: state.title.trim(),
          description: state.description.trim() || undefined,
          category: state.selectedCategory?._id,
          s3Key,
          fileName: state.file.name,
          fileSize: state.file.size,
          totalPages: detectedTotalPages,
          prompt: state.aiPrompt.trim() || undefined,
        }),
      });

      // Add to store
      addDraft({
        id: data.draftId,
        title: state.title.trim(),
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
      push('/dashboard');
    } catch (error: unknown) {
      toast.error(tCommon('error'), {
        description: extractUnknownErrorMessage(error, t('failedToStartProcessing')),
      });
    } finally {
      dispatch({ type: 'patch', value: { isUploading: false } });
    }
  };

  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="size-10 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{t('createQuiz')}</h1>
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
            ${state.file ? 'border-green-500 bg-green-50' : ''}
            ${state.isUploading ? 'opacity-50 pointer-events-none' : ''}
          `}
      >
        <input {...getInputProps()} />

        {state.file ? (
          <div className="text-center">
            <HiOutlineDocumentText className="mx-auto size-14 text-green-500" />
            <p className="mt-3 font-medium text-neutral-900">{state.file.name}</p>
            <p className="text-sm text-neutral-500">
              {(state.file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({
                  type: 'patch',
                  value: {
                    file: null,
                    title: '',
                    description: '',
                    selectedCategory: null,
                    aiPrompt: '',
                  },
                });
              }}
              className="mt-3 px-3 text-sm text-red-500 hover:text-red-600"
            >
              <HiOutlineX className="size-4" />
              {t('remove')}
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <HiOutlineUpload className="mx-auto size-14 text-neutral-400" />
            <p className="mt-3 font-medium text-neutral-700">
              {isDragActive ? t('dropPDFHere') : t('clickToUpload')}
            </p>
            <p className="text-sm text-neutral-500">{t('supportedFormats')}</p>
          </div>
        )}
      </div>

      {/* Title Input */}
      {state.file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {t('quizTitle')}
          </label>
          <Input
            type="text"
            value={state.title}
            onChange={(e) => dispatch({ type: 'patch', value: { title: e.target.value } })}
            placeholder={t('enterTitle')}
            className="h-[52px] rounded-xl px-4"
            disabled={state.isUploading}
          />
        </div>
      )}

      {/* Description Input */}
      {state.file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {t('descriptionOptional')}
          </label>
          <Textarea
            value={state.description}
            onChange={(e) => dispatch({ type: 'patch', value: { description: e.target.value } })}
            placeholder={t('provideContext')}
            rows={3}
            className="rounded-xl px-4 py-3"
            disabled={state.isUploading}
          />
        </div>
      )}

      {/* Category Selector */}
      {state.file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">{t('category')}</label>
          <CategorySelector
            value={state.selectedCategory}
            onChange={(selectedCategory) =>
              dispatch({ type: 'patch', value: { selectedCategory } })
            }
            placeholder={t('searchSelectCategory')}
            required
            disabled={state.isUploading}
          />
        </div>
      )}

      {/* AI Prompt Input */}
      {state.file && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {t('aiPromptLabel')}
          </label>
          <Textarea
            value={state.aiPrompt}
            onChange={(e) => dispatch({ type: 'patch', value: { aiPrompt: e.target.value } })}
            placeholder={t('aiPromptPlaceholder')}
            rows={3}
            className="rounded-xl px-4 py-3"
            disabled={state.isUploading}
          />
          <p className="text-xs text-neutral-500 mt-2">{t('aiPromptHelper')}</p>
        </div>
      )}

      {/* Submit Button */}
      {state.file && state.title.trim() && state.selectedCategory && (
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={state.isUploading}
          size="lg"
          className="mt-6 w-full rounded-full bg-green-500 hover:bg-brand-trust"
        >
          {state.isUploading ? (
            <>
              <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t('creatingDraft')}
            </>
          ) : (
            <>
              {t('createQuiz')}
              <HiOutlineArrowRight className="size-5" />
            </>
          )}
        </Button>
      )}

      {/* Desktop Hint */}
      <div className="mt-8 p-4 rounded-xl bg-neutral-100 flex items-start gap-3">
        <HiOutlineDesktopComputer className="mt-0.5 size-6 flex-shrink-0 text-neutral-500" />
        <div>
          <p className="text-sm font-medium text-neutral-700">{t('editTitleDescription')}</p>
          <p className="text-sm text-neutral-500 mt-0.5">{t('reviewQuestions')}</p>
        </div>
      </div>
    </div>
  );
}
