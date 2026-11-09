'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { matchesMedia } from '@/hooks/useMediaQuery';
import { MEDIA_MAX_MD } from '@/shared/constants/breakpoints';
import { useCallback, useEffect, useReducer } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { PdfPanelSkeleton, RedirectPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import QuizMetaForm from '@/features/quiz/components/QuizMetaForm';
import { PublicQuizNotice } from '@/features/quiz/components/PublicQuizNotice';
import PDFViewer from '@/features/quiz/components/PDFViewer';
import { useDraftStore } from '@/store/useDraftStore';
import { usePendingQuizUploadStore } from '@/store/usePendingQuizUploadStore';
import { toast } from 'sonner';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import {
  deletePendingPdfUpload,
  getPdfPageCount,
  shouldCleanupPendingPdfUpload,
  uploadPdfViaPresignedUrl,
} from '@/lib/pdf';
import { createQuizDraft } from '@/lib/quiz/draftApi';
import { getCreateQuizDraftErrorMessage } from '@/features/quiz/components/create/create-quiz-draft-error';
import { MAX_QUIZ_PDF_MB } from '@/lib/quiz/constants';
import { usePdfUploadPolicy } from '@/hooks/usePdfUploadPolicy';
import { openInNewTabSafely } from '@/lib/security/trusted-navigation';
import { useCreateResponsiveRedirect } from '@/hooks/useCreateResponsiveRedirect';
import { ROUTES } from '@/shared/constants/routes';
import { toCreateQuizDraftInput } from '@/features/quiz/components/create/create-quiz-draft-input';
import { CreateQuizErrorAlert } from '@/features/quiz/components/create/CreateQuizErrorAlert';
import {
  getPdfRejectionMessage,
  isPdfFile,
} from '@/features/quiz/components/create/pdf-file-error';
import {
  HiOutlineArrowRight,
  HiOutlineDocumentText,
  HiOutlineExclamationCircle,
  HiOutlineExternalLink,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineRefresh,
  HiOutlineUpload,
  HiOutlineX,
} from 'react-icons/hi';

interface CreateQuizState {
  title: string;
  description: string;
  aiPrompt: string;
  selectedFolderId: string | null;
  submitToPremium: boolean;
  rightsAttested: boolean;
  pdfFile: File | null;
  showPDFViewer: boolean;
  extracting: boolean;
  /** File-level errors (type, size, pages), shown above the card. */
  error: string;
  /** Submit-step errors, shown next to the submit button (RIN-991). */
  submitError: string;
}

type CreateQuizAction =
  | { type: 'patch'; value: Partial<CreateQuizState> }
  | { type: 'setPdfFile'; file: File | null };

interface PdfPreviewData {
  pdfUrl: string;
  fileInfo: string;
  totalPages: number;
}

type Translator = ReturnType<typeof useTranslations>;

const initialCreateQuizState: CreateQuizState = {
  title: '',
  description: '',
  aiPrompt: '',
  selectedFolderId: null,
  submitToPremium: false,
  rightsAttested: false,
  pdfFile: null,
  showPDFViewer: false,
  extracting: false,
  error: '',
  submitError: '',
};

function createQuizReducer(state: CreateQuizState, action: CreateQuizAction): CreateQuizState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'setPdfFile':
      return {
        ...state,
        pdfFile: action.file,
        title:
          action.file && !state.title.trim()
            ? action.file.name.replace(/\.pdf$/i, '')
            : action.file
              ? state.title
              : '',
        showPDFViewer: false,
      };
    default:
      return state;
  }
}

function PreviewPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-neutral-500">
        <svg
          className="size-16 mx-auto mb-4 text-neutral-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

function PDFViewerComponent({ file, onClose }: { file: File; onClose: () => void }) {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const { data, error, isLoading } = useSWR<PdfPreviewData>(
    ['create-pdf-preview', `${file.name}:${file.size}:${file.lastModified}`],
    async () => ({
      pdfUrl: URL.createObjectURL(file),
      fileInfo: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      totalPages: await getPdfPageCount(file),
    }),
    {
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    return () => {
      if (data?.pdfUrl) {
        URL.revokeObjectURL(data.pdfUrl);
      }
    };
  }, [data?.pdfUrl]);

  if (isLoading) {
    return <PdfPanelSkeleton label={`${t('loadingPDF')} ${t('thisWillTakeMoment')}`} />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center text-red-600 max-w-sm">
          <HiOutlineExclamationCircle className="size-8 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">{t('pdfLoadingError')}</p>
        </div>
      </div>
    );
  }

  if (!data?.pdfUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center text-neutral-500">
          <HiOutlineDocumentText className="size-8 mx-auto mb-2" />
          <p className="text-sm">{t('noPDFLoaded')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-shrink-0 p-3 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-x-2">
            <HiOutlineDocumentText className="size-4 text-brand-trust" />
            <span className="text-neutral-700 font-medium">
              {data.totalPages} {t('pages')}
            </span>
          </div>
          <div className="flex items-center gap-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  openInNewTabSafely(data.pdfUrl);
                }
              }}
              size="sm"
              className="min-h-[32px] border-green-200 bg-green-100 px-3 text-xs text-brand-trust hover:bg-green-200"
              title={t('openInNewTab')}
            >
              <HiOutlineExternalLink className="mr-1" /> {t('openInNewTab')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              size="sm"
              className="min-h-[32px] border-red-200 bg-red-100 px-3 text-xs text-red-700 hover:bg-red-200"
              title={t('hidePreview')}
            >
              {tCommon('close')}
            </Button>
          </div>
        </div>
        <p className="text-xs text-neutral-600 mt-1 truncate" title={data.fileInfo}>
          {data.fileInfo}
        </p>
      </div>

      <div className="flex-1 bg-white">
        <PDFViewer
          pdfDataUrl={data.pdfUrl}
          pdfUrl={data.pdfUrl}
          onClose={onClose}
          showHeader={false}
        />
      </div>
    </div>
  );
}

interface UploadSectionProps {
  extracting: boolean;
  isDragActive: boolean;
  getInputProps: ReturnType<typeof useDropzone>['getInputProps'];
  getRootProps: ReturnType<typeof useDropzone>['getRootProps'];
  onRemoveFile: () => void;
  pdfFile: File | null;
  maxPages: number;
  t: Translator;
}

function UploadSection({
  extracting,
  getInputProps,
  getRootProps,
  isDragActive,
  onRemoveFile,
  pdfFile,
  maxPages,
  t,
}: UploadSectionProps) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-700">{t('pdfDocument')}</p>
      {pdfFile ? (
        <Card variant="bordered" className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-x-3 min-w-0 flex-1">
              <div className="p-2 bg-red-100 rounded-xl flex-shrink-0">
                <HiOutlineDocumentText className="size-6 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 truncate" title={pdfFile.name}>
                  {pdfFile.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemoveFile}
              disabled={extracting}
              className="px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <HiOutlineX className="size-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <div
          {...getRootProps({
            'aria-label': t('pdfDocument'),
          })}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-[background-color,border-color,transform] duration-300 ${isDragActive ? 'scale-105 border-brand-action/60 bg-orange-50/50' : 'border-neutral-300 hover:border-brand-action/40 hover:bg-orange-50/30'}`}
        >
          <input {...getInputProps()} />
          <div className="space-y-4">
            <div
              className={`inline-flex items-center justify-center p-4 rounded-2xl ${isDragActive ? 'bg-orange-500/10' : 'bg-neutral-100'} transition-colors duration-300`}
            >
              <HiOutlineUpload
                className={`size-8 ${isDragActive ? 'text-brand-action' : 'text-neutral-400'}`}
              />
            </div>
            <div className="text-center">
              {isDragActive ? (
                <p className="text-lg font-semibold text-brand-action">{t('dropPDFHere')}</p>
              ) : (
                <div>
                  <p className="text-lg font-semibold text-neutral-700 mb-2">
                    <span className="text-brand-action hover:text-brand-action-hover transition-colors">
                      {t('clickToUpload')}
                    </span>{' '}
                    {t('dragAndDrop')}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {t('pdfLimitHint', { pages: maxPages })}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {t('pdfTechnicalLimit', { size: MAX_QUIZ_PDF_MB })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FormCardProps {
  error: string;
  submitError: string;
  getInputProps: ReturnType<typeof useDropzone>['getInputProps'];
  getRootProps: ReturnType<typeof useDropzone>['getRootProps'];
  interaction: {
    extracting: boolean;
    isDragActive: boolean;
    showPDFViewer: boolean;
  };
  onAiPromptChange: (value: string) => void;
  onFolderChange: (value: string | null) => void;
  onDescriptionChange: (value: string) => void;
  privacyControl?: {
    submitToPremium: boolean;
    eligible: boolean;
    onPremiumChange: (value: boolean) => void;
    rightsAttested: boolean;
    onRightsChange: (value: boolean) => void;
  };
  onRemoveFile: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onTitleChange: (value: string) => void;
  onTogglePreview: () => void;
  pdfFile: File | null;
  selectedFolderId: string | null;
  title: string;
  description: string;
  aiPrompt: string;
  t: Translator;
  tCommon: Translator;
  maxPages: number;
}

function CreateQuizFormCard({
  aiPrompt,
  description,
  error,
  submitError,
  getInputProps,
  getRootProps,
  interaction,
  onAiPromptChange,
  onFolderChange,
  onDescriptionChange,
  onRemoveFile,
  onSubmit,
  onTitleChange,
  onTogglePreview,
  pdfFile,
  privacyControl,
  selectedFolderId,
  t,
  tCommon,
  title,
  maxPages,
}: FormCardProps) {
  const { extracting, isDragActive, showPDFViewer } = interaction;

  return (
    <>
      <CreateQuizErrorAlert message={error} className="mx-auto mb-6 max-w-2xl" />

      <Card
        variant="glass"
        className="max-w-2xl mx-auto backdrop-blur-xl border-white/30 shadow-xl"
      >
        <CardHeader className="text-center">
          <h1 className="text-2xl font-semibold text-ink">{t('uploadPDFDocument')}</h1>
          <CardDescription className="text-base">{t('uploadDescription')}</CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <form onSubmit={onSubmit} className="space-y-6">
            <QuizMetaForm
              title={title}
              onTitleChange={onTitleChange}
              description={description}
              onDescriptionChange={onDescriptionChange}
              selectedFolderId={selectedFolderId}
              onFolderChange={onFolderChange}
              labels={{
                title: t('quizTitle'),
                titlePlaceholder: t('enterTitle'),
                description: t('descriptionOptional'),
                descriptionPlaceholder: t('provideContext'),
                folder: t('folderLabel'),
                premiumLabel: t('premiumQuiz'),
                premiumDescription: t('premiumQuizDescription'),
                premiumRightsLabel: t('premiumRightsLabel'),
                premiumRightsDescription: t('premiumRightsDescription'),
                promptLabel: t('aiPromptLabel'),
                promptPlaceholder: t('aiPromptPlaceholder'),
                promptHelper: t('aiPromptHelper'),
              }}
              {...(privacyControl !== undefined
                ? {
                    submitToPremium: privacyControl.submitToPremium,
                    premiumEligible: privacyControl.eligible,
                    premiumEligibilityMessage: t('premiumVerificationRequired'),
                    premiumEligibilityCta: t('verifyEmailCta'),
                    onPremiumChange: privacyControl.onPremiumChange,
                    premiumRightsAttested: privacyControl.rightsAttested,
                    onPremiumRightsChange: privacyControl.onRightsChange,
                  }
                : {})}
              premiumCheckboxId="submitToPremiumUpload"
              notice={
                <PublicQuizNotice
                  variant="full"
                  showPremiumPointer={privacyControl !== undefined}
                />
              }
              aiPrompt={aiPrompt}
              onAiPromptChange={onAiPromptChange}
              disabled={extracting}
            />

            <UploadSection
              extracting={extracting}
              getInputProps={getInputProps}
              getRootProps={getRootProps}
              isDragActive={isDragActive}
              onRemoveFile={onRemoveFile}
              pdfFile={pdfFile}
              maxPages={maxPages}
              t={t}
            />

            <div className="flex flex-col gap-4 pt-4">
              {pdfFile && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onTogglePreview}
                    className="min-h-[40px] border-green-200 px-4 text-brand-trust hover:bg-green-50"
                  >
                    {showPDFViewer ? (
                      <HiOutlineEyeOff className="size-4 mr-2" />
                    ) : (
                      <HiOutlineEye className="size-4 mr-2" />
                    )}
                    {showPDFViewer ? t('hidePDFPreview') : t('showPDFPreview')}
                  </Button>
                </div>
              )}

              <CreateQuizErrorAlert message={submitError} focusOnShow />

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <Link href="/">
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    <HiOutlineX className="size-4 mr-2" />
                    {tCommon('cancel')}
                  </Button>
                </Link>

                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  loading={extracting}
                  disabled={
                    !title.trim() ||
                    !pdfFile ||
                    (privacyControl?.submitToPremium === true && !privacyControl.rightsAttested)
                  }
                  className="w-full sm:w-auto"
                >
                  {extracting ? (
                    <>
                      <HiOutlineRefresh className="size-4 mr-2 animate-spin" />
                      {t('creatingDraft')}
                    </>
                  ) : (
                    <>
                      <HiOutlineArrowRight className="size-4 mr-2" />
                      {t('createQuizBackground')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

function PreviewPanel({
  file,
  isOpen,
  onClose,
  placeholder,
}: {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  placeholder: string;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="hidden lg:block lg:w-1/2 lg:pl-4">
      <div className="sticky top-24 h-[calc(100vh-6rem)]">
        <Card className="h-full flex flex-col shadow-2xl border-2 border-green-200 bg-white">
          <CardContent className="flex-1 flex flex-col p-4 min-h-0">
            {!file ? (
              <PreviewPlaceholder message={placeholder} />
            ) : (
              <div className="flex-1 border border-neutral-200 rounded overflow-hidden">
                <div className="w-full h-full">
                  <PDFViewerComponent file={file} onClose={onClose} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function CreateQuizPage() {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { data: session } = useSession();
  const { push, replace } = useRouter();
  const { addDraft } = useDraftStore();
  const consumePendingFile = usePendingQuizUploadStore((s) => s.consumeFile);
  const [state, dispatch] = useReducer(createQuizReducer, initialCreateQuizState);
  const isRedirecting = useCreateResponsiveRedirect('desktop');
  const uploadPolicy = usePdfUploadPolicy('quiz');

  const selectPdf = useCallback(
    async (file: File) => {
      if (!isPdfFile(file)) {
        dispatch({ type: 'patch', value: { error: t('pdfWrongType') } });
        return;
      }
      try {
        const pageCount = await getPdfPageCount(file);
        if (pageCount > uploadPolicy.maxPages) {
          dispatch({
            type: 'patch',
            value: {
              error: t('pdfTooManyPages', { pages: pageCount, maxPages: uploadPolicy.maxPages }),
            },
          });
          return;
        }
        dispatch({ type: 'patch', value: { error: '', submitError: '' } });
        dispatch({ type: 'setPdfFile', file });
      } catch {
        dispatch({ type: 'patch', value: { error: t('pdfUnreadable') } });
      }
    },
    [t, uploadPolicy.maxPages],
  );

  useEffect(() => {
    if (matchesMedia(MEDIA_MAX_MD)) {
      replace('/create/pdf/mobile');
    }
  }, [replace]);

  // Pick up a PDF dropped on the dashboard, handed off via the pending store.
  useEffect(() => {
    if (uploadPolicy.isLoading) return;
    const pending = consumePendingFile();
    if (pending) {
      void selectPdf(pending);
    }
  }, [consumePendingFile, selectPdf, uploadPolicy.isLoading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        void selectPdf(file);
      }
    },
    onDropRejected: (rejections) => {
      dispatch({
        type: 'patch',
        value: { error: getPdfRejectionMessage(rejections, t, MAX_QUIZ_PDF_MB) },
      });
    },
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: uploadPolicy.maxBytes,
    multiple: false,
    disabled: state.extracting || uploadPolicy.isLoading,
  });

  const handleBackgroundExtract = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!state.title.trim()) {
      dispatch({ type: 'patch', value: { submitError: t('titleRequired') } });
      return;
    }

    if (!state.pdfFile) {
      dispatch({ type: 'patch', value: { submitError: t('uploadOnePDF') } });
      return;
    }

    dispatch({ type: 'patch', value: { extracting: true, error: '', submitError: '' } });

    let pendingS3Key: string | null = null;
    try {
      const uploadFile = state.pdfFile;
      const { s3Key } = await uploadPdfViaPresignedUrl(uploadFile);
      pendingS3Key = s3Key;
      const trimmedTitle = state.title.trim();

      const draft = await createQuizDraft(toCreateQuizDraftInput(state, uploadFile, s3Key));
      pendingS3Key = null;

      addDraft({
        id: draft.id,
        title: trimmedTitle,
        status: 'processing',
        chunksTotal: 1,
        chunksProcessed: 0,
        chunksError: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
        ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
      });

      toast.success(t('processingStarted'));

      push(ROUTES.CREATE_QUIZ);
    } catch (error: unknown) {
      if (pendingS3Key && shouldCleanupPendingPdfUpload(error)) {
        await deletePendingPdfUpload(pendingS3Key, 'quiz').catch(() => undefined);
      }
      console.error('Error starting background processing:', error);
      dispatch({
        type: 'patch',
        value: {
          submitError: getCreateQuizDraftErrorMessage(error, t, apiErrorMessage),
          extracting: false,
        },
      });
    }
  };

  if (isRedirecting) {
    return <RedirectPageSkeleton label={t('processingStarted')} />;
  }

  return (
    <div className="min-h-[100dvh]">
      <main className="pt-20">
        <div className="flex min-h-[100dvh]">
          <div
            className={`px-4 pb-8 sm:px-6 lg:px-8 ${state.showPDFViewer ? 'lg:w-1/2 lg:pr-4' : 'w-full'}`}
          >
            <CreateQuizFormCard
              aiPrompt={state.aiPrompt}
              description={state.description}
              error={state.error}
              submitError={state.submitError}
              getInputProps={getInputProps}
              getRootProps={getRootProps}
              interaction={{
                extracting: state.extracting,
                isDragActive,
                showPDFViewer: state.showPDFViewer,
              }}
              onAiPromptChange={(value) => dispatch({ type: 'patch', value: { aiPrompt: value } })}
              onFolderChange={(value) =>
                dispatch({ type: 'patch', value: { selectedFolderId: value } })
              }
              onDescriptionChange={(value) =>
                dispatch({ type: 'patch', value: { description: value } })
              }
              onRemoveFile={() => dispatch({ type: 'setPdfFile', file: null })}
              onSubmit={(event) => {
                void handleBackgroundExtract(event);
              }}
              onTitleChange={(value) => dispatch({ type: 'patch', value: { title: value } })}
              onTogglePreview={() =>
                dispatch({ type: 'patch', value: { showPDFViewer: !state.showPDFViewer } })
              }
              pdfFile={state.pdfFile}
              privacyControl={{
                submitToPremium: state.submitToPremium,
                eligible: session?.user?.emailVerified === true,
                rightsAttested: state.rightsAttested,
                onPremiumChange: (value: boolean) =>
                  dispatch({
                    type: 'patch',
                    value: {
                      submitToPremium: value,
                      ...(!value ? { rightsAttested: false } : {}),
                    },
                  }),
                onRightsChange: (value: boolean) =>
                  dispatch({ type: 'patch', value: { rightsAttested: value } }),
              }}
              selectedFolderId={state.selectedFolderId}
              maxPages={uploadPolicy.maxPages}
              t={t}
              tCommon={tCommon}
              title={state.title}
            />
          </div>

          <PreviewPanel
            file={state.pdfFile}
            isOpen={state.showPDFViewer}
            onClose={() => dispatch({ type: 'patch', value: { showPDFViewer: false } })}
            placeholder={t('uploadPDFToPreview')}
          />
        </div>
      </main>
    </div>
  );
}
