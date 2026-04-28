'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import QuizMetaForm from '@/components/quiz/QuizMetaForm';
import PDFViewer from '@/components/ui/PDFViewer';
import { useDraftStore } from '@/store/useDraftStore';
import { toast } from 'sonner';
import {
  HiOutlineArrowRight,
  HiOutlineCheckCircle,
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

function PDFViewerComponent({ files, onClose }: { files: File[]; onClose: () => void }) {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [fileInfo, setFileInfo] = useState('');

  useEffect(() => {
    if (files.length === 0) {
      setPdfUrl('');
      setTotalPages(0);
      setFileInfo('');
      return;
    }

    const loadPDFs = async () => {
      setLoading(true);
      setError('');

      try {
        if (files.length === 1) {
          const url = URL.createObjectURL(files[0]);
          setPdfUrl(url);
          setFileInfo(`1 file: ${files[0].name} (${(files[0].size / 1024 / 1024).toFixed(2)} MB)`);
          setTotalPages(await getPdfPageCount(files[0]));
        } else {
          const merged = await mergePdfFiles(files);
          const url = URL.createObjectURL(merged);
          const names = files.map((f) => f.name).join(', ');
          const totalSize = files.reduce((sum, f) => sum + f.size, 0);

          setPdfUrl(url);
          setTotalPages(
            await getPdfPageCount(new File([merged], 'merged.pdf', { type: 'application/pdf' })),
          );
          setFileInfo(
            `${files.length} files merged: ${names} (${(totalSize / 1024 / 1024).toFixed(2)} MB total)`,
          );
        }
      } catch (err) {
        console.error('Error loading PDFs:', err);
        setError('Failed to load PDF files');
      } finally {
        setLoading(false);
      }
    };

    void loadPDFs();
  }, [files]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto mb-2" />
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
          <HiOutlineExclamationCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">{t('pdfLoadingError')}</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center text-neutral-500">
          <HiOutlineDocumentText className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">{t('noPDFLoaded')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-shrink-0 p-3 bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <HiOutlineDocumentText className="w-4 h-4 text-brand-trust" />
            <span className="text-neutral-700 font-medium">
              {totalPages} {t('pages')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(pdfUrl, '_blank');
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
        <p className="text-xs text-neutral-600 mt-1 truncate" title={fileInfo}>
          {fileInfo}
        </p>
      </div>

      <div className="flex-1 bg-white">
        <PDFViewer pdfDataUrl={pdfUrl} pdfUrl={pdfUrl} onClose={onClose} showHeader={false} />
      </div>
    </div>
  );
}

export default function CreateQuizPage() {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { addDraft } = useDraftStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.replace('/create/mobile');
    }
  }, [router]);

  const onDrop = (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setPdfFiles((prev) => [...prev, ...acceptedFiles]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 10,
    maxSize: 50 * 1024 * 1024,
    disabled: extracting,
  });

  const totalUploadedSizeMb = useMemo(() => {
    const bytes = pdfFiles.reduce((sum, file) => sum + file.size, 0);
    return (bytes / 1024 / 1024).toFixed(2);
  }, [pdfFiles]);

  const removeFile = (index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPdfViaPresignedUrl = async (file: File): Promise<{ s3Key: string }> => {
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
      headers: { 'Content-Type': 'application/pdf' },
      body: file,
    });

    if (!putResponse.ok) {
      throw new Error(`Storage upload failed with status ${putResponse.status}`);
    }

    return { s3Key: payload.data.s3Key as string };
  };

  const handleBackgroundExtract = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError(t('titleRequired'));
      return;
    }

    if (!selectedCategory?._id) {
      setError(t('selectCategory'));
      return;
    }

    if (pdfFiles.length === 0) {
      setError(t('uploadOnePDF'));
      return;
    }

    setExtracting(true);
    setError('');
    setSuccess('');

    try {
      let uploadFile: File;

      if (pdfFiles.length === 1) {
        uploadFile = pdfFiles[0];
      } else {
        const merged = await mergePdfFiles(pdfFiles);
        uploadFile = new File([merged], 'merged.pdf', { type: 'application/pdf' });
      }

      const detectedTotalPages = await getPdfPageCount(uploadFile);
      const { s3Key } = await uploadPdfViaPresignedUrl(uploadFile);

      const response = await fetch('/api/draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          s3Key,
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          totalPages: detectedTotalPages,
          categoryId: selectedCategory._id,
          description: description.trim() || undefined,
          prompt: aiPrompt.trim() || undefined,
          isPrivate,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Failed to create draft');
      }

      const { draftId, chunks, totalPages, expiresAt } = await response.json();

      addDraft({
        id: draftId,
        title: title.trim(),
        status: 'processing',
        chunksTotal: chunks.total,
        chunksProcessed: 0,
        chunksError: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
        expiresAt,
      });

      toast.success(t('processingStarted'), {
        description: t('pagesChunks', { pages: totalPages, chunks: chunks.total }),
      });

      router.push('/');
    } catch (err: any) {
      console.error('Error starting background processing:', err);
      setError(err?.message || t('failedToStartProcessing'));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />

      <main className="pt-20">
        <div className="flex min-h-screen transition-[width] duration-300">
          <div
            className={`px-4 pb-8 transition-[width,padding] duration-300 sm:px-6 lg:px-8 ${showPDFViewer ? 'lg:w-1/2 lg:pr-4' : 'w-full'}`}
          >
            {error && (
              <Card
                variant="bordered"
                className="border-red-200 bg-red-50 p-4 mb-6 max-w-2xl mx-auto"
                role="alert"
                aria-live="polite"
              >
                <div className="flex items-center text-red-700">
                  <HiOutlineExclamationCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </Card>
            )}

            {success && (
              <Card
                variant="bordered"
                className="border-green-200 bg-green-50 p-4 mb-6 max-w-2xl mx-auto"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center text-green-700">
                  <HiOutlineCheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm font-medium">{success}</span>
                </div>
              </Card>
            )}

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
                <form
                  onSubmit={(e) => {
                    void handleBackgroundExtract(e);
                  }}
                  className="space-y-6"
                >
                  <QuizMetaForm
                    title={title}
                    onTitleChange={setTitle}
                    description={description}
                    onDescriptionChange={setDescription}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
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
                    onPrivateChange={setIsPrivate}
                    privateCheckboxId="isPrivateUpload"
                    aiPrompt={aiPrompt}
                    onAiPromptChange={setAiPrompt}
                    disabled={extracting}
                  />

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
                            className={`h-8 w-8 ${isDragActive ? 'text-brand-action' : 'text-neutral-400'}`}
                          />
                        </div>
                        <div className="text-center">
                          {extracting ? (
                            <div className="flex items-center justify-center space-x-2">
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
                              <p className="text-sm font-semibold text-brand-trust">
                                {t('processingFiles')}
                              </p>
                            </div>
                          ) : isDragActive ? (
                            <p className="text-lg font-semibold text-brand-action">
                              {t('dropPDFHere')}
                            </p>
                          ) : (
                            <div>
                              <p className="text-lg font-semibold text-neutral-700 mb-2">
                                <span className="text-brand-action hover:text-brand-action-hover transition-colors">
                                  {t('clickToUpload')}
                                </span>{' '}
                                {t('dragAndDrop')}
                              </p>
                              <p className="text-sm text-neutral-500">{t('multiplePDFAllowed')}</p>
                              <p className="text-xs text-neutral-400 mt-1">
                                {t('supportedFormats')}
                              </p>
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
                            onClick={() => setShowRemoveAllConfirm(true)}
                            className="px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <HiOutlineTrash className="w-4 h-4 mr-1" />
                            {tCommon('removeAll')}
                          </Button>
                        </div>

                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {pdfFiles.map((file, index) => (
                            <Card
                              key={`${file.name}-${index}`}
                              variant="bordered"
                              className="p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                  <div className="p-2 bg-red-100 rounded-xl flex-shrink-0">
                                    <HiOutlineDocumentText className="h-6 w-6 text-red-600" />
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
                                  onClick={() => removeFile(index)}
                                  className="px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  <HiOutlineX className="w-4 h-4" />
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>

                        <p className="text-xs text-neutral-500">
                          Total size: {totalUploadedSizeMb} MB
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 pt-4">
                    {pdfFiles.length > 0 && (
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowPDFViewer(!showPDFViewer)}
                          className="min-h-[40px] border-green-200 px-4 text-brand-trust hover:bg-green-50"
                        >
                          {showPDFViewer ? (
                            <HiOutlineEyeOff className="w-4 h-4 mr-2" />
                          ) : (
                            <HiOutlineEye className="w-4 h-4 mr-2" />
                          )}
                          {showPDFViewer ? t('hidePDFPreview') : t('showPDFPreview')}
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <Link href="/">
                        <Button type="button" variant="outline" className="w-full sm:w-auto">
                          <HiOutlineX className="w-4 h-4 mr-2" />
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
                            <HiOutlineRefresh className="w-4 h-4 mr-2 animate-spin" />
                            {t('creatingDraft')}
                          </>
                        ) : (
                          <>
                            <HiOutlineArrowRight className="w-4 h-4 mr-2" />
                            {t('createQuizBackground')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {showPDFViewer && (
            <div className="hidden lg:block lg:w-1/2 lg:pl-4">
              <div className="sticky top-24 h-[calc(100vh-6rem)]">
                <Card className="h-full flex flex-col shadow-2xl border-2 border-green-200 bg-white">
                  <CardContent className="flex-1 flex flex-col p-4 min-h-0">
                    {pdfFiles.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-neutral-500">
                          <svg
                            className="w-16 h-16 mx-auto mb-4 text-neutral-300"
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
                          <p className="text-sm">{t('uploadPDFToPreview')}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 border border-neutral-200 rounded overflow-hidden">
                        <div className="w-full h-full">
                          <PDFViewerComponent
                            files={pdfFiles}
                            onClose={() => setShowPDFViewer(false)}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={showRemoveAllConfirm}
          title={t('confirmRemoveAllTitle')}
          message={t('confirmRemoveAllMessage', { count: pdfFiles.length })}
          confirmText={tCommon('removeAll')}
          cancelText={tCommon('cancel')}
          confirmVariant="destructive"
          onConfirm={() => {
            setPdfFiles([]);
            setShowRemoveAllConfirm(false);
          }}
          onCancel={() => setShowRemoveAllConfirm(false)}
        />
      </main>
    </div>
  );
}

async function mergePdfFiles(files: File[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  return new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
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
