'use client';

import Link from 'next/link';
import { useQuizCreation } from '@/hooks/useQuizCreation';
import { extractQuestionsFromPDF, createQuiz } from '@/services/quizService';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { QuizPreviewModal } from '@/components/ui/QuizPreviewModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';
import { CategorySelector } from '@/components/ui/CategorySelector';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { extractQuestionsFromLargePDF, UploadProgress } from '@/services/largeFileUploadService';
import { LargeFileUploadProgress } from '@/components/ui/LargeFileUploadProgress';
import { Question } from '@/types/quiz';
import { useDraftStore } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import { toast } from 'sonner';
import {
  HiOutlinePlus,
  HiOutlineExclamationCircle,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineX,
  HiOutlineTrash,
  HiOutlineCheckCircle,
  HiOutlineLightBulb,
  HiOutlineUpload,
  HiOutlineArrowRight,
  HiOutlineRefresh,
  HiOutlineTag,
  HiOutlineLockClosed,
  HiOutlineExternalLink
} from '@/components/icons';

// Enhanced PDF Viewer Component with merge capability
function PDFViewerComponent({ files, onClose }: { files: File[]; onClose: () => void }) {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [fileInfo, setFileInfo] = useState<string>('');

  useEffect(() => {
    if (files.length === 0) {
      setPdfUrl('');
      setTotalPages(0);
      setFileInfo('');
      return;
    }

    loadPDFs();
  }, [files]);

  const loadPDFs = async () => {
    setLoading(true);
    setError('');

    try {
      if (files.length === 1) {
        // Single file - create URL directly
        const url = URL.createObjectURL(files[0]);
        setPdfUrl(url);
        setFileInfo(`1 file: ${files[0].name} (${(files[0].size / 1024 / 1024).toFixed(2)} MB)`);

        // Count pages for single file
        await countPDFPages(files[0]);
      } else {
        // Multiple files - merge them
        await mergePDFs();
      }
    } catch (err) {
      console.error('Error loading PDFs:', err);
      setError('Failed to load PDF files');
    } finally {
      setLoading(false);
    }
  };

  const countPDFPages = async (file: File) => {
    try {
      // Use pdf-lib instead of pdfjs-dist for page counting (more compatible with Next.js)
      const { PDFDocument } = await import('pdf-lib');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setTotalPages(pdf.getPageCount());
    } catch (err) {
      console.error('Error counting pages:', err);
      setTotalPages(0);
    }
  };

  const mergePDFs = async () => {
    try {
      // Dynamic import for PDF-lib
      const { PDFDocument } = await import('pdf-lib');

      const mergedPdf = await PDFDocument.create();
      let totalPageCount = 0;
      const fileNames: string[] = [];
      let totalSize = 0;

      console.log(`🔗 Merging ${files.length} PDF files...`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📄 Processing file ${i + 1}/${files.length}: ${file.name}`);

        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);
          const pageIndices = pdf.getPageIndices();

          // Copy pages to merged document
          const pages = await mergedPdf.copyPages(pdf, pageIndices);
          pages.forEach((page) => mergedPdf.addPage(page));

          totalPageCount += pageIndices.length;
          fileNames.push(file.name);
          totalSize += file.size;

          console.log(`✅ Added ${pageIndices.length} pages from ${file.name}`);
        } catch (fileError) {
          console.error(`❌ Error processing ${file.name}:`, fileError);
          // Continue with other files even if one fails
        }
      }

      if (totalPageCount === 0) {
        throw new Error('No pages could be extracted from any PDF file');
      }

      // Save merged PDF
      console.log('💾 Saving merged PDF…');
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setPdfUrl(url);
      setTotalPages(totalPageCount);
      setFileInfo(`${files.length} files merged: ${fileNames.join(', ')} (${(totalSize / 1024 / 1024).toFixed(2)} MB total)`);

      console.log(`✅ Successfully merged ${files.length} files into ${totalPageCount} pages`);

    } catch (err) {
      console.error('Error merging PDFs:', err);
      setError(`Failed to merge PDF files: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Cleanup URL when component unmounts or files change
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">
            {files.length > 1 ? t('mergingPDFs', { count: files.length }) : t('loadingPDF')}
          </p>
          <p className="text-xs text-gray-500 mt-1">{t('thisWillTakeMoment')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
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
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <HiOutlineDocumentText className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">{t('noPDFLoaded')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* PDF Info Header */}
      <div className="flex-shrink-0 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <HiOutlineDocumentText className="w-4 h-4 text-blue-600" />
            <span className="text-gray-700 font-medium">{totalPages} {t('pages')}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(pdfUrl, '_blank')
                }
              }}
              className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
              title={t('openInNewTab')}
            >
              <HiOutlineExternalLink className="mr-1" /> {t('openInNewTab')}
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              title={t('hidePreview')}
            >
              {tCommon('close')}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-1 truncate" title={fileInfo}>
          {fileInfo}
        </p>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 bg-white">
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=page-width`}
          className="w-full h-full border-0"
          title="Merged PDF Viewer"
          style={{ minHeight: '500px' }}
        />
      </div>
    </div>
  );
}

export default function CreateQuizPage() {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const tQuiz = useTranslations('quiz');
  const router = useRouter();
  const { addDraft } = useDraftStore();
  const { startProcessing } = usePdfProcessor();

  // Mobile redirect
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.replace('/create/mobile');
    }
  }, [router]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [isPrivate, setIsPrivate] = useState(false);

  // File upload state
  const {
    pdfFiles,
    setPdfFiles,
    showPDFViewer,
    setShowPDFViewer,
    getRootProps,
    getInputProps,
    isDragActive,
    removeFile,
    removeAllFiles,
    isUploading,
    addQuestion,
    removeQuestion
  } = useQuizCreation();

  // Processing state
  const [extracting, setExtracting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Preview state
  const [previewData, setPreviewData] = useState<any>(null);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [editableQuestions, setEditableQuestions] = useState<Question[]>([]);

  // Large file upload state
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    currentChunk: 0,
    totalChunks: 0,
    currentFile: 0,
    totalFiles: 0,
    fileName: '',
    status: 'uploading',
    message: ''
  });
  const [showLargeFileProgress, setShowLargeFileProgress] = useState(false);

  // UI state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);
  const [questionToRemove, setQuestionToRemove] = useState<number | null>(null);

  // Extract questions from PDF
  const handleExtractQuestions = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError(t('titleRequired'));
      return;
    }

    if (!selectedCategory) {
      setError(t('selectCategory'));
      return;
    }

    if (pdfFiles.length === 0) {
      setError(t('uploadOnePDF'));
      return;
    }

    setExtracting(true);
    setError('');
    setShowLargeFileProgress(false);

    try {
      // Check if any file is larger than 4MB
      const hasLargeFile = pdfFiles.some(file => file.size > 4 * 1024 * 1024);

      if (hasLargeFile) {
        // Use large file upload service
        setShowLargeFileProgress(true);

        const data = await extractQuestionsFromLargePDF(
          pdfFiles,
          title.trim(),
          description.trim(),
          (progress) => {
            setUploadProgress(progress);
          },
          {
            prompt: aiPrompt.trim() || undefined
          }
        );

        setPreviewData(data);
        setEditableTitle(data.title);
        setEditableDescription(data.description);
        setEditableQuestions(data.questions);

        // Hide progress after a short delay
        setTimeout(() => {
          setShowLargeFileProgress(false);
        }, 2000);

      } else {
        // Use regular service for small files
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('description', description.trim());

        pdfFiles.forEach((file, index) => {
          formData.append(`pdfFile_${index}`, file);
        });
        formData.append('fileCount', pdfFiles.length.toString());
        if (aiPrompt.trim()) {
          formData.append('prompt', aiPrompt.trim());
        }

        const data = await extractQuestionsFromPDF(formData);

        setPreviewData(data);
        setEditableTitle(data.title);
        setEditableDescription(data.description);
        setEditableQuestions(data.questions);
      }

    } catch (err: any) {
      console.error('Error extracting questions:', err);
      const errorMessage = err.message || t('failedToExtract');
      setError(`${errorMessage}. ${t('tryAgainOrContact')}`);
      setShowLargeFileProgress(false);
    } finally {
      setExtracting(false);
    }
  };

  // Create quiz
  const handleCreateQuiz = async () => {
    if (!editableTitle.trim()) {
      setError(t('quizTitleRequiredError'));
      return;
    }

    if (editableQuestions.length === 0) {
      setError(t('oneQuestionRequired'));
      return;
    }

    setCreating(true);
    setError('');

    try {
      const result = await createQuiz({
        title: editableTitle.trim(),
        description: editableDescription.trim(),
        questions: editableQuestions,
        category: selectedCategory!._id,
        isPrivate
      });

      setSuccess(result.message || t('quizCreatedSuccess'));

      setTimeout(() => {
        router.push('/pending');
      }, 3000);

    } catch (err: any) {
      console.error('Error creating quiz:', err);
      const errorMessage = err.message || t('failedToCreate');
      setError(`${errorMessage}. ${t('tryAgainOrContact')}`);
    } finally {
      setCreating(false);
    }
  };

  // Question management functions
  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...editableQuestions]
    updated[index] = { ...updated[index], [field]: value }
    setEditableQuestions(updated)
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...editableQuestions]
    updated[questionIndex].options[optionIndex] = value
    setEditableQuestions(updated)
  }

  const updateQuestionType = (questionIndex: number, type: 'single' | 'multiple') => {
    const updated = [...editableQuestions]
    updated[questionIndex] = { ...updated[questionIndex], type }

    // Reset correct answers when changing type
    if (type === 'single') {
      updated[questionIndex].correctIndex = 0
      delete updated[questionIndex].correctIndexes
    } else {
      updated[questionIndex].correctIndexes = []
      delete updated[questionIndex].correctIndex
    }

    setEditableQuestions(updated)
  }

  const updateSingleChoice = (questionIndex: number, optionIndex: number) => {
    const updated = [...editableQuestions]
    updated[questionIndex].correctIndex = optionIndex
    setEditableQuestions(updated)
  }

  const updateMultipleChoice = (questionIndex: number, optionIndex: number, checked: boolean) => {
    const updated = [...editableQuestions]
    const currentIndexes = updated[questionIndex].correctIndexes || []

    if (checked) {
      updated[questionIndex].correctIndexes = [...currentIndexes, optionIndex]
    } else {
      updated[questionIndex].correctIndexes = currentIndexes.filter(i => i !== optionIndex)
    }

    setEditableQuestions(updated)
  }

  const updateQuestionImage = (questionIndex: number, imageUrl: string) => {
    const updated = [...editableQuestions]
    updated[questionIndex].questionImage = imageUrl
    setEditableQuestions(updated)
  }

  const removeQuestionImage = (questionIndex: number) => {
    const updated = [...editableQuestions]
    delete updated[questionIndex].questionImage
    setEditableQuestions(updated)
  }

  const updateOptionImage = (questionIndex: number, optionIndex: number, imageUrl: string) => {
    const updated = [...editableQuestions]
    if (!updated[questionIndex].optionImages) {
      updated[questionIndex].optionImages = []
    }
    updated[questionIndex].optionImages![optionIndex] = imageUrl
    setEditableQuestions(updated)
  }

  const removeOptionImage = (questionIndex: number, optionIndex: number) => {
    const updated = [...editableQuestions]
    if (updated[questionIndex].optionImages) {
      updated[questionIndex].optionImages[optionIndex] = undefined
    }
    setEditableQuestions(updated)
  }

  const backToUpload = () => {
    setPreviewData(null)
    setEditableTitle('')
    setEditableDescription('')
    setEditableQuestions([])
    setError('')
    setSuccess('')
  }

  const removeQuestionLocal = (index: number) => {
    setEditableQuestions(prev => prev.filter((_, i) => i !== index))
  }

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Background processing handler
  const handleBackgroundExtract = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError(t('titleRequired'));
      return;
    }

    if (pdfFiles.length === 0) {
      setError(t('uploadOnePDF'));
      return;
    }

    setExtracting(true);
    setError('');

    try {
      // For multiple files, we'll merge them first using pdf-lib
      let base64Data: string;
      let fileName: string;

      if (pdfFiles.length === 1) {
        // Single file - convert directly
        base64Data = await fileToBase64(pdfFiles[0]);
        fileName = pdfFiles[0].name;
      } else {
        // Multiple files - merge them first
        const { PDFDocument } = await import('pdf-lib');
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < pdfFiles.length; i++) {
          const file = pdfFiles[i];
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);
          const pageIndices = pdf.getPageIndices();
          const pages = await mergedPdf.copyPages(pdf, pageIndices);
          pages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const mergedFile = new File([blob], 'merged.pdf', { type: 'application/pdf' });
        base64Data = await fileToBase64(mergedFile);
        fileName = `${pdfFiles.length} merged files`;
      }

      // Create draft via API
      const response = await fetch('/api/draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          pdfBase64: base64Data,
          fileName: fileName,
          category: selectedCategory?._id,
          description: description.trim(),
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

      // Navigate to home - DraftSyncProvider will resume processing
      // This prevents the abort that happens when this component unmounts
      router.push('/');

    } catch (err: any) {
      console.error('Error starting background processing:', err);
      setError(err.message || t('failedToStartProcessing'));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Main Layout - 50/50 split when PDF is visible */}
      <main className="pt-20">
        <div className="flex min-h-screen transition-all duration-300">
          {/* Left Side - Form Content (50% when PDF visible, full width when not) */}
          <div className={`transition-all duration-300 ${showPDFViewer ? 'lg:w-1/2 lg:pr-4' : 'w-full'} px-4 sm:px-6 lg:px-8 pb-8`}>

            {/* Error/Success Messages */}
            {error && (
              <Card variant="bordered" className="border-red-200 bg-red-50 p-4 mb-6 max-w-2xl mx-auto animate-fadeInUp" role="alert" aria-live="polite">
                <div className="flex items-center text-red-700">
                  <HiOutlineExclamationCircle className="w-5 h-5 mr-2 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </Card>
            )}

            {success && (
              <Card variant="bordered" className="border-emerald-200 bg-emerald-50 p-4 mb-6 max-w-2xl mx-auto animate-fadeInUp" role="status" aria-live="polite">
                <div className="flex items-center text-emerald-700">
                  <HiOutlineCheckCircle className="w-5 h-5 mr-2 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium">{success}</span>
                </div>
              </Card>
            )}

            {!previewData ? (
              /* Step 1: Upload Form */
              <Card variant="glass" className="max-w-2xl mx-auto backdrop-blur-xl border-white/30 shadow-xl animate-fadeInUp">
                <CardHeader className="text-center">
                  <CardTitle size="lg" className="text-gray-900">{t('uploadPDFDocument')}</CardTitle>
                  <CardDescription className="text-base">
                    {t('uploadDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <form onSubmit={handleExtractQuestions} className="space-y-6">
                    <div className="space-y-5">
                      <Input
                        label={t('quizTitle')}
                        id="title"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('enterTitle')}
                        maxLength={200}
                        variant="glass"
                        icon={
                          <HiOutlineTag className="w-5 h-5" />
                        }
                      />

                      <Textarea
                        label={t('descriptionOptional')}
                        id="description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('provideContext')}
                        maxLength={1000}
                        variant="glass"
                      />

                      <div>
                        <Textarea
                          label={t('aiPromptLabel')}
                          id="aiPrompt"
                          rows={3}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder={t('aiPromptPlaceholder')}
                          maxLength={2000}
                          variant="glass"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          {t('aiPromptHelper')}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          {t('category')}
                        </label>
                        <CategorySelector
                          value={selectedCategory}
                          onChange={setSelectedCategory}
                          placeholder={t('searchSelectCategory')}
                          required
                        />
                      </div>

                      {/* Privacy Setting */}
                      <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-xl border border-violet-200">
                        <label htmlFor="isPrivateUpload" className="flex items-start space-x-3 cursor-pointer">
                          <div className="flex items-center h-5">
                            <input
                              type="checkbox"
                              id="isPrivateUpload"
                              checked={isPrivate}
                              onChange={(e) => setIsPrivate(e.target.checked)}
                              className="w-4 h-4 text-violet-600 bg-white border-gray-300 rounded focus:ring-violet-500 focus:ring-2"
                            />
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-900 flex items-center">
                              <HiOutlineLockClosed className="w-4 h-4 mr-1 text-violet-600" aria-hidden="true" />
                              {t('privateQuiz')}
                            </span>
                            <p className="text-xs text-gray-600 mt-1">
                              {t('privateQuizDescription')}
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* PDF Upload Section */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        {t('pdfDocument')}
                      </label>

                      <div>
                        <div
                          {...getRootProps()}
                          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${isDragActive
                              ? 'border-violet-400 bg-violet-50/50 backdrop-blur-sm scale-105'
                              : 'border-gray-300 hover:border-violet-300 hover:bg-violet-50/30'
                            }`}
                        >
                          <input {...getInputProps()} />
                          <div className="space-y-4">
                            <div className={`inline-flex items-center justify-center p-4 rounded-2xl ${isDragActive ? 'bg-violet-500/20' : 'bg-gray-100'
                              } transition-colors duration-300`}>
                              <HiOutlineUpload
                                className={`h-8 w-8 ${isDragActive ? 'text-violet-600' : 'text-gray-400'}`}
                              />
                            </div>
                            <div className="text-center">
                              {isUploading ? (
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-600"></div>
                                  <p className="text-sm font-semibold text-violet-700">{t('processingFiles')}</p>
                                </div>
                              ) : isDragActive ? (
                                <p className="text-lg font-semibold text-violet-700">{t('dropPDFHere')}</p>
                              ) : (
                                <div>
                                  <p className="text-lg font-semibold text-gray-700 mb-2">
                                    <span className="text-violet-600 hover:text-violet-700 transition-colors">{t('clickToUpload')}</span> {t('dragAndDrop')}
                                  </p>
                                  <p className="text-sm text-gray-500">{t('multiplePDFAllowed')}</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {t('supportedFormats')}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* File List */}
                        {pdfFiles.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold text-gray-700">
                                {t('selectedFiles', { count: pdfFiles.length })}
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowRemoveAllConfirm(true)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <HiOutlineTrash className="w-4 h-4 mr-1" aria-hidden="true" />
                                {tCommon('removeAll')}
                              </Button>
                            </div>

                            <div className="space-y-3 max-h-60 overflow-y-auto">
                              {pdfFiles.map((file, index) => (
                                <Card key={index} variant="bordered" className="p-4 hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                      <div className="p-2 bg-red-100 rounded-xl flex-shrink-0">
                                        <HiOutlineDocumentText className="h-6 w-6 text-red-600" aria-hidden="true" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-900 truncate" title={file.name}>{file.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeFile(index)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <HiOutlineX className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-4 pt-4">
                      {/* PDF Preview Toggle */}
                      {pdfFiles.length > 0 && (
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowPDFViewer(!showPDFViewer)}
                            className="text-violet-600 border-violet-200 hover:bg-violet-50"
                          >
                            {showPDFViewer ? <HiOutlineEyeOff className="w-4 h-4 mr-2" /> : <HiOutlineEye className="w-4 h-4 mr-2" />}
                            {showPDFViewer ? t('hidePDFPreview') : t('showPDFPreview')}
                          </Button>
                        </div>
                      )}

                      {/* Main Action Buttons */}
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                        <Link href="/">
                          <Button type="button" variant="outline" className="w-full sm:w-auto">
                            <HiOutlineX className="w-4 h-4 mr-2" />
                            {tCommon('cancel')}
                          </Button>
                        </Link>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            loading={extracting}
                            disabled={!title.trim() || pdfFiles.length === 0}
                            onClick={handleBackgroundExtract}
                            className="w-full sm:w-auto border-violet-200 text-violet-600 hover:bg-violet-50"
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
                          <Button
                            type="submit"
                            variant="gradient"
                            size="lg"
                            loading={extracting}
                            disabled={!title.trim() || !selectedCategory || pdfFiles.length === 0}
                            className="w-full sm:w-auto"
                          >
                            {extracting ? (
                              <>
                                <HiOutlineRefresh className="w-4 h-4 mr-2 animate-spin" />
                                {t('extractingQuestions')}
                              </>
                            ) : (
                              <>
                                <HiOutlineLightBulb className="w-4 h-4 mr-2" />
                                {t('extractQuestions')}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              /* Step 2: Preview and Edit - Questions will be rendered here */
              <div className="space-y-6">
                {/* Quiz Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('quizInformation')}</CardTitle>
                    <CardDescription>
                      {t('editTitleDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label htmlFor="editTitle" className="block text-sm font-medium text-gray-700">
                        {t('quizTitleRequired')}
                      </label>
                      <div className="mt-1">
                        <Input
                          id="editTitle"
                          type="text"
                          required
                          value={editableTitle}
                          onChange={(e) => setEditableTitle(e.target.value)}
                          placeholder={t('enterQuizTitle')}
                          maxLength={200}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700">
                        {t('descriptionField')}
                      </label>
                      <div className="mt-1">
                        <Textarea
                          id="editDescription"
                          rows={3}
                          value={editableDescription}
                          onChange={(e) => setEditableDescription(e.target.value)}
                          placeholder={t('enterQuizDescription')}
                          maxLength={1000}
                          variant="glass"
                        />
                      </div>
                    </div>


                  </CardContent>
                </Card>

                {/* Questions */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>{t('questionsCount', { count: editableQuestions.length })}</CardTitle>
                        <CardDescription>
                          {t('reviewQuestions')}
                        </CardDescription>
                      </div>
                      <Button onClick={addQuestion} size="sm">
                        {tQuiz('addQuestion')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {editableQuestions.map((question, questionIndex) => (
                      <div key={questionIndex} className="border border-gray-200 rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-gray-900">{t('questionNumber', { number: questionIndex + 1 })}</h4>
                          <Button
                            onClick={() => setQuestionToRemove(questionIndex)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            {t('remove')}
                          </Button>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('questionText')}
                          </label>
                          <textarea
                            value={question.question}
                            onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder={t('enterQuestion')}
                            required
                          />

                          {/* Question Image Upload */}
                          <div className="mt-3">
                            <div className="text-sm font-medium text-gray-700 mb-2">{t('questionImageOptional')}</div>
                            <QuestionImageUpload
                              currentImage={question.questionImage}
                              onImageUploaded={(imageUrl) => updateQuestionImage(questionIndex, imageUrl)}
                              onImageRemoved={() => removeQuestionImage(questionIndex)}
                            />
                          </div>
                        </div>

                        {/* Question Type Selector */}
                        <fieldset>
                          <legend className="block text-sm font-medium text-gray-700 mb-2">
                            {t('questionType')}
                          </legend>
                          <div className="flex space-x-4">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`type-${questionIndex}`}
                                checked={question.type === 'single'}
                                onChange={() => updateQuestionType(questionIndex, 'single')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {t('singleChoice')}
                              </span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`type-${questionIndex}`}
                                checked={question.type === 'multiple'}
                                onChange={() => updateQuestionType(questionIndex, 'multiple')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {t('multipleChoice')}
                              </span>
                            </label>
                          </div>
                        </fieldset>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('answerOptions')} {question.type === 'single'
                              ? t('clickRadioCorrect')
                              : t('checkBoxesCorrect')
                            }
                          </label>
                          <div className="space-y-2">
                            {question.options.map((option, optionIndex) => {
                              let isSelected = false;

                              if (question.type === 'single') {
                                isSelected = question.correctIndex === optionIndex;
                              } else {
                                isSelected = (question.correctIndexes || []).includes(optionIndex);
                              }

                              return (
                                <div key={optionIndex} className={`flex items-center space-x-2 p-2 rounded-lg border ${isSelected
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'
                                  }`}>
                                  {question.type === 'single' ? (
                                    <input
                                      type="radio"
                                      name={`correct-${questionIndex}`}
                                      checked={isSelected}
                                      onChange={() => updateSingleChoice(questionIndex, optionIndex)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                      aria-label={t('markCorrectAnswer', { number: optionIndex + 1 })}
                                    />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => updateMultipleChoice(questionIndex, optionIndex, e.target.checked)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                      aria-label={t('markCorrectAnswer', { number: optionIndex + 1 })}
                                    />
                                  )}
                                  <div className="flex-1">
                                    <Input
                                      value={option}
                                      onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                                      placeholder={t('optionPlaceholder', { number: optionIndex + 1 })}
                                      required
                                      className={isSelected ? 'border-green-300' : ''}
                                    />

                                    {/* Option Image Upload */}
                                    <OptionImageUpload
                                      currentImage={question.optionImages?.[optionIndex]}
                                      onImageUploaded={(imageUrl) => updateOptionImage(questionIndex, optionIndex, imageUrl)}
                                      onImageRemoved={() => removeOptionImage(questionIndex, optionIndex)}
                                    />
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xs font-medium text-gray-600">
                                      {String.fromCharCode(65 + optionIndex)}.
                                    </span>
                                    {isSelected && (
                                      <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                                        {t('correctMark')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}

                    {editableQuestions.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        {t('noQuestionsManual')}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <Button onClick={backToUpload} variant="outline" className="w-full sm:w-auto">
                    {t('backToUpload')}
                  </Button>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {pdfFiles.length > 0 && (
                      <Button
                        onClick={() => setShowPDFViewer(!showPDFViewer)}
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
                      >
                        📄 {showPDFViewer ? t('hidePDFReference') : t('showPDFReference')}
                      </Button>
                    )}
                    <Button
                      onClick={() => setShowPreviewModal(true)}
                      variant="outline"
                      disabled={editableQuestions.length === 0}
                      className="w-full sm:w-auto"
                    >
                      {t('previewQuiz')}
                    </Button>
                    <Link href="/">
                      <Button variant="outline" className="w-full sm:w-auto">{tCommon('cancel')}</Button>
                    </Link>
                    <Button
                      onClick={handleCreateQuiz}
                      loading={creating}
                      disabled={!editableTitle.trim() || editableQuestions.length === 0}
                      className="w-full sm:w-auto"
                    >
                      {creating ? t('creatingQuiz') : t('createQuiz')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Side - PDF Viewer (50% when visible) */}
          {showPDFViewer && (
            <div className="hidden lg:block lg:w-1/2 lg:pl-4">
              <div className="sticky top-24 h-[calc(100vh-6rem)]">
                <Card className="h-full flex flex-col shadow-2xl border-2 border-blue-200 bg-white">
                  {/* <CardHeader className="flex-shrink-0 pb-3">
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={() => setShowPDFViewer(false)}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </Button>
                    </div>
                  </CardHeader> */}

                  <CardContent className="flex-1 flex flex-col p-4 min-h-0">
                    {pdfFiles.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm">{t('uploadPDFToPreview')}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 border border-gray-200 rounded overflow-hidden">
                        <div className="w-full h-full">
                          <PDFViewerComponent files={pdfFiles} onClose={() => setShowPDFViewer(false)} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {showPreviewModal && (
          <QuizPreviewModal
            isOpen={showPreviewModal}
            onClose={() => setShowPreviewModal(false)}
            title={editableTitle}
            questions={editableQuestions.map(q => ({
              question: q.question,
              options: q.options,
              type: q.type,
              correctIndex: q.type === 'single' ? q.correctIndex : undefined,
              correctIndexes: q.type === 'multiple' ? (q.correctIndexes || []) : undefined
            }))}
          />
        )}

        {/* Large File Upload Progress Modal */}
        <LargeFileUploadProgress
          progress={uploadProgress}
          isVisible={showLargeFileProgress}
        />

        {/* Confirmation Modal for Remove All Files */}
        <ConfirmModal
          isOpen={showRemoveAllConfirm}
          title={t('confirmRemoveAllTitle')}
          message={t('confirmRemoveAllMessage', { count: pdfFiles.length })}
          confirmText={tCommon('removeAll')}
          cancelText={tCommon('cancel')}
          confirmVariant="destructive"
          onConfirm={() => {
            removeAllFiles();
            setShowRemoveAllConfirm(false);
          }}
          onCancel={() => setShowRemoveAllConfirm(false)}
        />

        {/* Confirmation Modal for Remove Question */}
        <ConfirmModal
          isOpen={questionToRemove !== null}
          title={t('confirmRemoveQuestionTitle')}
          message={t('confirmRemoveQuestionMessage', { number: (questionToRemove ?? 0) + 1 })}
          confirmText={t('remove')}
          cancelText={tCommon('cancel')}
          confirmVariant="destructive"
          onConfirm={() => {
            if (questionToRemove !== null) {
              removeQuestionLocal(questionToRemove);
              setQuestionToRemove(null);
            }
          }}
          onCancel={() => setQuestionToRemove(null)}
        />
      </main>
    </div>
  );
}
