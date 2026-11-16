'use client';

import { describeApiError } from '@/lib/api/error-kind';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { useRouter } from '@/i18n/navigation';
import { useCallback, useEffect, useReducer } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { useDraftStore } from '@/store/useDraftStore';
import {
  HiOutlineUpload,
  HiOutlineDocumentText,
  HiOutlineArrowRight,
  HiOutlineX,
} from 'react-icons/hi';
import { toast } from 'sonner';
import { FolderSelector } from '@/features/folders/components/FolderSelector';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { RedirectPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import {
  deletePendingPdfUpload,
  getPdfPageCount,
  shouldCleanupPendingPdfUpload,
  uploadPdfViaPresignedUrl,
} from '@/lib/pdf';
import { createQuizDraft, createTextQuizDraft } from '@/lib/quiz/draftApi';
import { getCreateQuizDraftErrorMessage } from '@/features/quiz/components/create/create-quiz-draft-error';
import { MAX_QUIZ_PDF_MB } from '@/lib/quiz/constants';
import { usePdfUploadPolicy } from '@/hooks/usePdfUploadPolicy';
import { usePendingQuizUploadStore } from '@/store/usePendingQuizUploadStore';
import { useCreateResponsiveRedirect } from '@/hooks/useCreateResponsiveRedirect';
import { ROUTES } from '@/shared/constants/routes';
import { CreateQuizErrorAlert } from '@/features/quiz/components/create/CreateQuizErrorAlert';
import { PublicQuizNotice } from '@/features/quiz/components/PublicQuizNotice';
import { getPdfRejectionMessage } from '@/features/quiz/components/create/pdf-file-error';
import {
  CREATE_FILE_ACCEPT,
  OFFICE_MAX_FILE_MB,
  createFileKind,
  getOfficeRefusalMessage,
  readOfficeFile,
  titleFromFileName,
  type OfficeSource,
} from '@/features/quiz/components/create/office-source';
import { QUIZ_TEXT_MAX_CHARS } from '@/shared/constants/quiz-text-source';
import { reportDropzoneRejection, reportUploadRejection } from '@/lib/upload-rejection-client';

type MobileCreateState = {
  file: File | null;
  /** The text of a Word or PowerPoint file, read in the browser when it was picked (RIN-1787). */
  office: OfficeSource | null;
  title: string;
  description: string;
  selectedFolderId: string | null;
  aiPrompt: string;
  isUploading: boolean;
  /**
   * File-level error (wrong type, too many pages, unreadable, too large),
   * shown under the dropzone until the file changes, as on desktop (RIN-1082).
   */
  fileError: string;
  /** Submit-step error, shown right above the submit button (RIN-991). */
  submitError: string;
};

type MobileCreateAction =
  | { type: 'patch'; value: Partial<MobileCreateState> }
  | { type: 'setFile'; value: File | null; office?: OfficeSource };

const initialState: MobileCreateState = {
  file: null,
  office: null,
  title: '',
  description: '',
  selectedFolderId: null,
  aiPrompt: '',
  isUploading: false,
  fileError: '',
  submitError: '',
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
        office: action.office ?? null,
        fileError: '',
        submitError: '',
        title: action.value ? titleFromFileName(action.value.name) : '',
        aiPrompt: action.value ? state.aiPrompt : '',
      };
    default:
      return state;
  }
}

export function MobileCreateQuizPage() {
  const t = useTranslations('create');
  const apiErrorMessage = useApiErrorMessage();
  const { push } = useRouter();
  const { addDraft } = useDraftStore();
  const consumePendingFile = usePendingQuizUploadStore((s) => s.consumeFile);
  const [state, dispatch] = useReducer(mobileCreateReducer, initialState);
  const isRedirecting = useCreateResponsiveRedirect('mobile');
  const uploadPolicy = usePdfUploadPolicy('quiz');

  const selectPdf = useCallback(
    async (file: File) => {
      if (createFileKind(file) !== 'pdf') {
        // Word and PowerPoint are read here, in the browser; anything else is refused.
        const read = await readOfficeFile(file);
        if (!read.ok) {
          reportUploadRejection({ file, reason: read.reason, surface: 'create_pdf_mobile' });
          dispatch({
            type: 'patch',
            value: { fileError: getOfficeRefusalMessage(read.reason, t, OFFICE_MAX_FILE_MB) },
          });
          return;
        }
        dispatch({ type: 'setFile', value: file, office: read.source });
        return;
      }
      try {
        const pageCount = await getPdfPageCount(file);
        if (pageCount > uploadPolicy.maxPages) {
          reportUploadRejection({ file, reason: 'too_many_pages', surface: 'create_pdf_mobile' });
          dispatch({
            type: 'patch',
            value: {
              fileError: t('pdfTooManyPages', {
                pages: pageCount,
                maxPages: uploadPolicy.maxPages,
              }),
            },
          });
          return;
        }
        dispatch({ type: 'setFile', value: file });
      } catch {
        reportUploadRejection({ file, reason: 'unreadable', surface: 'create_pdf_mobile' });
        dispatch({ type: 'patch', value: { fileError: t('pdfUnreadable') } });
      }
    },
    [t, uploadPolicy.maxPages],
  );

  // Pick up a PDF dropped on the dashboard, if any.
  useEffect(() => {
    if (uploadPolicy.isLoading) return;
    const pending = consumePendingFile();
    if (pending) {
      void selectPdf(pending);
    }
  }, [consumePendingFile, selectPdf, uploadPolicy.isLoading]);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      void selectPdf(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      reportDropzoneRejection(rejections, 'create_pdf_mobile');
      dispatch({
        type: 'patch',
        value: { fileError: getPdfRejectionMessage(rejections, t, MAX_QUIZ_PDF_MB) },
      });
    },
    accept: CREATE_FILE_ACCEPT,
    maxFiles: 1,
    maxSize: uploadPolicy.maxBytes,
    disabled: state.isUploading || uploadPolicy.isLoading,
  });

  const handleSubmit = async () => {
    if (!state.file || !state.title.trim()) return;

    dispatch({ type: 'patch', value: { isUploading: true, fileError: '', submitError: '' } });

    let pendingS3Key: string | null = null;
    try {
      const description = state.description.trim();
      const prompt = state.aiPrompt.trim();
      let draft;
      if (state.office) {
        // A Word or PowerPoint file was read in the browser: only its text is sent, as a text draft.
        draft = await createTextQuizDraft({
          title: state.title.trim(),
          text: state.office.text,
          folderId: state.selectedFolderId,
          office: { fileType: state.office.fileType, surface: 'create_pdf_mobile' },
          ...(description ? { description } : {}),
          ...(prompt ? { prompt } : {}),
        });
      } else {
        const { s3Key } = await uploadPdfViaPresignedUrl(state.file);
        pendingS3Key = s3Key;
        draft = await createQuizDraft({
          title: state.title.trim(),
          s3Key,
          fileName: state.file.name,
          fileSize: state.file.size,
          folderId: state.selectedFolderId,
          description: description || undefined,
          prompt: prompt || undefined,
        });
        pendingS3Key = null;
      }

      addDraft({
        id: draft.id,
        title: state.title.trim(),
        status: 'processing',
        chunksTotal: 1,
        chunksProcessed: 0,
        chunksError: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
        ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
      });

      toast.success(t('processingStarted'));

      // Return to the draft hub where processing progress remains visible.
      push(ROUTES.CREATE_QUIZ);
    } catch (error: unknown) {
      if (pendingS3Key && shouldCleanupPendingPdfUpload(error)) {
        await deletePendingPdfUpload(pendingS3Key, 'quiz').catch(() => undefined);
      }
      // The upgrade modal is the prompt for entitlement errors (no double prompt).
      const submitError =
        describeApiError(error).kind === 'unlock_required'
          ? ''
          : getCreateQuizDraftErrorMessage(error, t, apiErrorMessage);
      dispatch({ type: 'patch', value: { isUploading: false, submitError } });
    }
  };

  if (isRedirecting) {
    return <RedirectPageSkeleton label={t('creatingDraft')} />;
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-50 px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">{t('uploadPDFDocument')}</h1>
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
            {state.office?.truncated ? (
              <p className="mt-1 text-xs text-neutral-600">
                {t('officeTruncatedNote', { max: QUIZ_TEXT_MAX_CHARS })}
              </p>
            ) : null}
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
                    office: null,
                    fileError: '',
                    title: '',
                    description: '',
                    selectedFolderId: null,
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
            <p className="text-sm text-neutral-500">
              {t('pdfLimitHint', { pages: uploadPolicy.maxPages })}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {t('pdfTechnicalLimit', { size: MAX_QUIZ_PDF_MB, officeSize: OFFICE_MAX_FILE_MB })}
            </p>
          </div>
        )}
      </div>

      <CreateQuizErrorAlert message={state.fileError} className="mt-4" />

      {/* Title Input */}
      {state.file && (
        <div className="mt-5">
          <label
            htmlFor="mobile-create-quiz-title"
            className="mb-2 block text-sm font-medium text-neutral-700"
          >
            {t('quizTitle')}
          </label>
          <Input
            id="mobile-create-quiz-title"
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
          <label
            htmlFor="mobile-create-quiz-description"
            className="mb-2 block text-sm font-medium text-neutral-700"
          >
            {t('descriptionOptional')}
          </label>
          <Textarea
            id="mobile-create-quiz-description"
            value={state.description}
            onChange={(e) => dispatch({ type: 'patch', value: { description: e.target.value } })}
            placeholder={t('provideContext')}
            rows={3}
            className="rounded-xl px-4 py-3"
            disabled={state.isUploading}
          />
        </div>
      )}

      {/* Folder Selector */}
      {state.file && (
        <div className="mt-5">
          <label
            htmlFor="mobile-create-quiz-folder"
            className="mb-2 block text-sm font-medium text-neutral-700"
          >
            {t('folderLabel')}
          </label>
          <FolderSelector
            id="mobile-create-quiz-folder"
            value={state.selectedFolderId}
            onChange={(selectedFolderId) =>
              dispatch({ type: 'patch', value: { selectedFolderId } })
            }
            disabled={state.isUploading}
          />
        </div>
      )}

      {/* AI Prompt Input */}
      {state.file && (
        <div className="mt-5">
          <label
            htmlFor="mobile-create-quiz-ai-prompt"
            className="mb-2 block text-sm font-medium text-neutral-700"
          >
            {t('aiPromptLabel')}
          </label>
          <Textarea
            id="mobile-create-quiz-ai-prompt"
            value={state.aiPrompt}
            onChange={(e) => dispatch({ type: 'patch', value: { aiPrompt: e.target.value } })}
            placeholder={t('aiPromptPlaceholder')}
            rows={3}
            className="rounded-xl px-4 py-3"
            disabled={state.isUploading}
          />
          <p className="mt-2 text-xs text-neutral-500">{t('aiPromptHelper')}</p>
        </div>
      )}

      {/* RIN-1339: no Premium checkbox on mobile, so no Premium pointer either. */}
      {state.file && <PublicQuizNotice variant="full" className="mt-6" />}

      {state.file && (
        <CreateQuizErrorAlert message={state.submitError} className="mt-6" focusOnShow />
      )}

      {/* Submit Button */}
      {state.file && (
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={state.isUploading || !state.title.trim()}
          size="lg"
          className="mt-6 w-full rounded-full"
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
    </div>
  );
}
