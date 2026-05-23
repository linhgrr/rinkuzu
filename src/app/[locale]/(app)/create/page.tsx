'use client';

import Link from 'next/link';
import { useEffect, useMemo, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import QuizMetaForm from '@/features/quiz/components/QuizMetaForm';
import PDFViewer from '@/features/quiz/components/PDFViewer';
import { useDraftStore } from '@/store/useDraftStore';
import { toast } from 'sonner';
import { fetchApiData } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { getPdfPageCount, uploadPdfViaPresignedUrl } from '@/lib/pdf';
import { openInNewTabSafely } from '@/lib/security/trusted-navigation';
import { useCreateResponsiveRedirect } from '@/hooks/useCreateResponsiveRedirect';
import {
  HiOutlineArrowRight,
  HiOutlineDocumentText,
  HiOutlineExclamationCircle,
  HiOutlineExternalLink,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineRefresh,
  HiOutlineTrash,
  HiOutlineUpload,
  HiOutlineX,
} from '@/components/icons';

interface Category {
  _id: string;
  name: string;
  description?: string;
  color?: string;
}

interface CreateQuizState {
  title: string;
  description: string;
  aiPrompt: string;
  selectedCategory: Category | null;
  isPrivate: boolean;
  pdfFiles: File[];
  showPDFViewer: boolean;
  extracting: boolean;
  error: string;
  showRemoveAllConfirm: boolean;
}

type CreateQuizAction =
  | { type: 'patch'; value: Partial<CreateQuizState> }
  | { type: 'appendPdfFiles'; files: File[] }
  | { type: 'removePdfFile'; index: number }
  | { type: 'clearPdfFiles' };

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
  selectedCategory: null,
  isPrivate: false,
  pdfFiles: [],
  showPDFViewer: false,
  extracting: false,
  error: '',
  showRemoveAllConfirm: false,
};

function createQuizReducer(state: CreateQuizState, action: CreateQuizAction): CreateQuizState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'appendPdfFiles':
      return {
        ...state,
        pdfFiles: [...state.pdfFiles, ...action.files],
      };
    case 'removePdfFile':
      return {
        ...state,
        pdfFiles: state.pdfFiles.filter((_, index) => index !== action.index),
      };
    case 'clearPdfFiles':
      return {
        ...state,
        pdfFiles: [],
        showPDFViewer: false,
        showRemoveAllConfirm: false,
      };
    default:
      return state;
  }
}

function StatusAlert({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <Card
      variant="bordered"
      className="border-red-200 bg-red-50 p-4 mb-6 max-w-2xl mx-auto"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center text-red-700">
        <HiOutlineExclamationCircle className="size-5 mr-2 flex-shrink-0" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </Card>
  );
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

function PDFViewerComponent({ files, onClose }: { files: File[]; onClose: () => void }) {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const previewKey = useMemo(
    () =>
      files.length === 0
        ? null
        : [
            'create-pdf-preview',
            ...files.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
          ],
    [files],
  );
  const { data, error, isLoading } = useSWR<PdfPreviewData>(
    previewKey,
    async () => {
      if (files.length === 1) {
        return {
          pdfUrl: URL.createObjectURL(files[0]),
          fileInfo: `1 file: ${files[0].name} (${(files[0].size / 1024 / 1024).toFixed(2)} MB)`,
          totalPages: await getPdfPageCount(files[0]),
        };
      }

      const merged = await mergePdfFiles(files);
      const mergedFile = new File([merged], 'merged.pdf', { type: 'application/pdf' });
      const names = files.map((file) => file.name).join(', ');
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      return {
        pdfUrl: URL.createObjectURL(mergedFile),
        totalPages: await getPdfPageCount(mergedFile),
        fileInfo: `${files.length} files merged: ${names} (${(totalSize / 1024 / 1024).toFixed(2)} MB total)`,
      };
    },
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
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto mb-2" />
          <p className="text-sm text-neutral-600">
            {files.length > 1 ? t('mergingPDFs', { count: files.length }) : t('loadingPDF')}
          </p>
          <p className="text-xs text-neutral-500 mt-1">{t('thisWillTakeMoment')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center text-red-600 max-w-sm">
          <HiOutlineExclamationCircle className="size-8 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">{t('pdfLoadingError')}</p>
          <p className="text-xs">{extractUnknownErrorMessage(error, 'Failed to load PDF files')}</p>
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
      <div className="flex-shrink-0 p-3 bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200">
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
  onRemoveAll: () => void;
  onRemoveFile: (index: number) => void;
  pdfFiles: File[];
  t: Translator;
  tCommon: Translator;
  totalUploadedSizeMb: string;
}

function UploadSection({
  extracting,
  getInputProps,
  getRootProps,
  isDragActive,
  onRemoveAll,
  onRemoveFile,
  pdfFiles,
  t,
  tCommon,
  totalUploadedSizeMb,
}: UploadSectionProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-neutral-700 mb-3">
        {t('pdfDocument')}
      </label>
      <div
        {...getRootProps()}
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
            {extracting ? (
              <div className="flex items-center justify-center gap-x-2">
                <div className="size-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
                <p className="text-sm font-semibold text-brand-trust">{t('processingFiles')}</p>
              </div>
            ) : isDragActive ? (
              <p className="text-lg font-semibold text-brand-action">{t('dropPDFHere')}</p>
            ) : (
              <div>
                <p className="text-lg font-semibold text-neutral-700 mb-2">
                  <span className="text-brand-action hover:text-brand-action-hover transition-colors">
                    {t('clickToUpload')}
                  </span>{' '}
                  {t('dragAndDrop')}
                </p>
                <p className="text-sm text-neutral-500">{t('multiplePDFAllowed')}</p>
                <p className="text-xs text-neutral-400 mt-1">{t('supportedFormats')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {pdfFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-neutral-700">
              {t('selectedFiles', { count: pdfFiles.length })}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemoveAll}
              className="px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <HiOutlineTrash className="size-4 mr-1" />
              {tCommon('removeAll')}
            </Button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {pdfFiles.map((file, index) => (
              <Card
                key={`${file.name}-${file.size}-${file.lastModified}`}
                variant="bordered"
                className="p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-x-3 min-w-0 flex-1">
                    <div className="p-2 bg-red-100 rounded-xl flex-shrink-0">
                      <HiOutlineDocumentText className="size-6 text-red-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold text-neutral-900 truncate"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFile(index)}
                    className="px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <HiOutlineX className="size-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <p className="text-xs text-neutral-500">Total size: {totalUploadedSizeMb} MB</p>
        </div>
      )}
    </div>
  );
}

interface FormCardProps {
  extracting: boolean;
  error: string;
  getInputProps: ReturnType<typeof useDropzone>['getInputProps'];
  getRootProps: ReturnType<typeof useDropzone>['getRootProps'];
  isDragActive: boolean;
  onAiPromptChange: (value: string) => void;
  onCategoryChange: (value: Category | null) => void;
  onDescriptionChange: (value: string) => void;
  onPrivateChange: (value: boolean) => void;
  onRemoveAll: () => void;
  onRemoveFile: (index: number) => void;
  onSubmit: (event: React.FormEvent) => void;
  onTitleChange: (value: string) => void;
  onTogglePreview: () => void;
  pdfFiles: File[];
  selectedCategory: Category | null;
  showPDFViewer: boolean;
  title: string;
  description: string;
  aiPrompt: string;
  isPrivate: boolean;
  totalUploadedSizeMb: string;
  t: Translator;
  tCommon: Translator;
}

function CreateQuizFormCard({
  aiPrompt,
  description,
  error,
  extracting,
  getInputProps,
  getRootProps,
  isDragActive,
  isPrivate,
  onAiPromptChange,
  onCategoryChange,
  onDescriptionChange,
  onPrivateChange,
  onRemoveAll,
  onRemoveFile,
  onSubmit,
  onTitleChange,
  onTogglePreview,
  pdfFiles,
  selectedCategory,
  showPDFViewer,
  t,
  tCommon,
  title,
  totalUploadedSizeMb,
}: FormCardProps) {
  return (
    <>
      <StatusAlert message={error} />

      <Card
        variant="glass"
        className="max-w-2xl mx-auto backdrop-blur-xl border-white/30 shadow-xl"
      >
        <CardHeader className="text-center">
          <CardTitle size="lg" className="text-neutral-900">
            {t('uploadPDFDocument')}
          </CardTitle>
          <CardDescription className="text-base">{t('uploadDescription')}</CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <form onSubmit={onSubmit} className="space-y-6">
            <QuizMetaForm
              title={title}
              onTitleChange={onTitleChange}
              description={description}
              onDescriptionChange={onDescriptionChange}
              selectedCategory={selectedCategory}
              onCategoryChange={onCategoryChange}
              labels={{
                title: t('quizTitle'),
                titlePlaceholder: t('enterTitle'),
                description: t('descriptionOptional'),
                descriptionPlaceholder: t('provideContext'),
                category: t('category'),
                categoryPlaceholder: t('searchSelectCategory'),
                privateLabel: t('privateQuiz'),
                privateDescription: t('privateQuizDescription'),
                promptLabel: t('aiPromptLabel'),
                promptPlaceholder: t('aiPromptPlaceholder'),
                promptHelper: t('aiPromptHelper'),
              }}
              isPrivate={isPrivate}
              onPrivateChange={onPrivateChange}
              privateCheckboxId="isPrivateUpload"
              aiPrompt={aiPrompt}
              onAiPromptChange={onAiPromptChange}
              disabled={extracting}
            />

            <UploadSection
              extracting={extracting}
              getInputProps={getInputProps}
              getRootProps={getRootProps}
              isDragActive={isDragActive}
              onRemoveAll={onRemoveAll}
              onRemoveFile={onRemoveFile}
              pdfFiles={pdfFiles}
              t={t}
              tCommon={tCommon}
              totalUploadedSizeMb={totalUploadedSizeMb}
            />

            <div className="flex flex-col gap-4 pt-4">
              {pdfFiles.length > 0 && (
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
                  disabled={!title.trim() || !selectedCategory?._id || pdfFiles.length === 0}
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
  files,
  isOpen,
  onClose,
  placeholder,
}: {
  files: File[];
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
            {files.length === 0 ? (
              <PreviewPlaceholder message={placeholder} />
            ) : (
              <div className="flex-1 border border-neutral-200 rounded overflow-hidden">
                <div className="w-full h-full">
                  <PDFViewerComponent files={files} onClose={onClose} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CreateQuizPage() {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const { push, replace } = useRouter();
  const { addDraft } = useDraftStore();
  const [state, dispatch] = useReducer(createQuizReducer, initialCreateQuizState);
  const isRedirecting = useCreateResponsiveRedirect('desktop');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      replace('/create/mobile');
    }
  }, [replace]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        dispatch({ type: 'appendPdfFiles', files: acceptedFiles });
      }
    },
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 10,
    maxSize: 50 * 1024 * 1024,
    disabled: state.extracting,
  });

  const totalUploadedSizeMb = useMemo(() => {
    const bytes = state.pdfFiles.reduce((sum, file) => sum + file.size, 0);
    return (bytes / 1024 / 1024).toFixed(2);
  }, [state.pdfFiles]);

  const handleBackgroundExtract = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!state.title.trim()) {
      dispatch({ type: 'patch', value: { error: t('titleRequired') } });
      return;
    }

    if (!state.selectedCategory?._id) {
      dispatch({ type: 'patch', value: { error: t('selectCategory') } });
      return;
    }

    if (state.pdfFiles.length === 0) {
      dispatch({ type: 'patch', value: { error: t('uploadOnePDF') } });
      return;
    }

    dispatch({ type: 'patch', value: { extracting: true, error: '' } });

    try {
      const uploadFile =
        state.pdfFiles.length === 1
          ? state.pdfFiles[0]
          : new File([await mergePdfFiles(state.pdfFiles)], 'merged.pdf', {
              type: 'application/pdf',
            });

      const detectedTotalPages = await getPdfPageCount(uploadFile);
      const { s3Key } = await uploadPdfViaPresignedUrl(uploadFile);
      const trimmedTitle = state.title.trim();
      const trimmedDescription = state.description.trim();
      const trimmedPrompt = state.aiPrompt.trim();

      const data = await fetchApiData<{
        draftId: string;
        chunks: { total: number };
        totalPages: number;
        expiresAt: string;
      }>('/api/draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          s3Key,
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          totalPages: detectedTotalPages,
          categoryId: state.selectedCategory._id,
          description: trimmedDescription || undefined,
          prompt: trimmedPrompt || undefined,
          isPrivate: state.isPrivate,
        }),
      });

      addDraft({
        id: data.draftId,
        title: trimmedTitle,
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

      push('/');
    } catch (error: unknown) {
      console.error('Error starting background processing:', error);
      dispatch({
        type: 'patch',
        value: { error: extractUnknownErrorMessage(error, t('failedToStartProcessing')) },
      });
    } finally {
      dispatch({ type: 'patch', value: { extracting: false } });
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
    <div className="min-h-screen">
      <Navigation />

      <main className="pt-20">
        <div className="flex min-h-screen transition-[width] duration-300">
          <div
            className={`px-4 pb-8 transition-[width,padding] duration-300 sm:px-6 lg:px-8 ${state.showPDFViewer ? 'lg:w-1/2 lg:pr-4' : 'w-full'}`}
          >
            <CreateQuizFormCard
              aiPrompt={state.aiPrompt}
              description={state.description}
              error={state.error}
              extracting={state.extracting}
              getInputProps={getInputProps}
              getRootProps={getRootProps}
              isDragActive={isDragActive}
              isPrivate={state.isPrivate}
              onAiPromptChange={(value) => dispatch({ type: 'patch', value: { aiPrompt: value } })}
              onCategoryChange={(value) =>
                dispatch({ type: 'patch', value: { selectedCategory: value } })
              }
              onDescriptionChange={(value) =>
                dispatch({ type: 'patch', value: { description: value } })
              }
              onPrivateChange={(value) => dispatch({ type: 'patch', value: { isPrivate: value } })}
              onRemoveAll={() => dispatch({ type: 'patch', value: { showRemoveAllConfirm: true } })}
              onRemoveFile={(index) => dispatch({ type: 'removePdfFile', index })}
              onSubmit={(event) => {
                void handleBackgroundExtract(event);
              }}
              onTitleChange={(value) => dispatch({ type: 'patch', value: { title: value } })}
              onTogglePreview={() =>
                dispatch({ type: 'patch', value: { showPDFViewer: !state.showPDFViewer } })
              }
              pdfFiles={state.pdfFiles}
              selectedCategory={state.selectedCategory}
              showPDFViewer={state.showPDFViewer}
              t={t}
              tCommon={tCommon}
              title={state.title}
              totalUploadedSizeMb={totalUploadedSizeMb}
            />
          </div>

          <PreviewPanel
            files={state.pdfFiles}
            isOpen={state.showPDFViewer}
            onClose={() => dispatch({ type: 'patch', value: { showPDFViewer: false } })}
            placeholder={t('uploadPDFToPreview')}
          />
        </div>

        <ConfirmModal
          isOpen={state.showRemoveAllConfirm}
          title={t('confirmRemoveAllTitle')}
          message={t('confirmRemoveAllMessage', { count: state.pdfFiles.length })}
          confirmText={tCommon('removeAll')}
          cancelText={tCommon('cancel')}
          confirmVariant="destructive"
          onConfirm={() => dispatch({ type: 'clearPdfFiles' })}
          onCancel={() => dispatch({ type: 'patch', value: { showRemoveAllConfirm: false } })}
        />
      </main>
    </div>
  );
}

async function mergePdfFiles(files: File[]): Promise<Blob> {
  const pdfDocumentPromise = import('pdf-lib');
  const arrayBufferPromise = Promise.all(files.map((file) => file.arrayBuffer()));
  const [{ PDFDocument }, arrayBuffers] = await Promise.all([
    pdfDocumentPromise,
    arrayBufferPromise,
  ]);
  const [mergedPdf, pdfs] = await Promise.all([
    PDFDocument.create(),
    Promise.all(arrayBuffers.map((arrayBuffer) => PDFDocument.load(arrayBuffer))),
  ]);
  const copyOperations = pdfs.map((pdf) => mergedPdf.copyPages(pdf, pdf.getPageIndices()));
  const pageGroups = await Promise.all(copyOperations);

  pageGroups.forEach((pages) => {
    pages.forEach((page) => mergedPdf.addPage(page));
  });

  const mergedPdfBytes = await mergedPdf.save();
  return new Blob([mergedPdfBytes as BlobPart], { type: 'application/pdf' });
}
