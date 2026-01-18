'use client';

import Link from 'next/link';
import { useQuizCreation } from '@/hooks/useQuizCreation';
import { extractQuestionsFromPDF, createQuiz } from '@/services/quizService';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { QuizPreviewModal } from '@/components/ui/QuizPreviewModal';
import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';
import { CategorySelector } from '@/components/ui/CategorySelector';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
import { useTranslation } from '@/lib/i18n';

// Enhanced PDF Viewer Component with merge capability
function PDFViewerComponent({ files, onClose }: { files: File[]; onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [fileInfo, setFileInfo] = useState<string>('');
  const { text } = useTranslation();

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
        setFileInfo(
          text({
            en: `1 file: ${files[0].name} (${(files[0].size / 1024 / 1024).toFixed(2)} MB)`,
            vi: `1 tệp: ${files[0].name} (${(files[0].size / 1024 / 1024).toFixed(2)} MB)`,
          })
        );

        // Count pages for single file
        await countPDFPages(files[0]);
      } else {
        // Multiple files - merge them
        await mergePDFs();
      }
    } catch (err) {
      console.error('Error loading PDFs:', err);
      setError(text({ en: 'Failed to load PDF files', vi: 'Không thể tải tệp PDF' }));
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
        throw new Error(
          text({
            en: 'No pages could be extracted from any PDF file',
            vi: 'Không thể trích xuất trang nào từ các tệp PDF',
          })
        );
      }

      // Save merged PDF
      console.log('💾 Saving merged PDF...');
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setPdfUrl(url);
      setTotalPages(totalPageCount);
      setFileInfo(
        text({
          en: `${files.length} files merged: ${fileNames.join(', ')} (${(totalSize / 1024 / 1024).toFixed(2)} MB total)`,
          vi: `${files.length} tệp đã gộp: ${fileNames.join(', ')} (tổng ${(totalSize / 1024 / 1024).toFixed(2)} MB)`,
        })
      );

      console.log(`✅ Successfully merged ${files.length} files into ${totalPageCount} pages`);

    } catch (err) {
      console.error('Error merging PDFs:', err);
      setError(
        text({
          en: `Failed to merge PDF files: ${err instanceof Error ? err.message : 'Unknown error'}`,
          vi: `Không thể gộp tệp PDF: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`,
        })
      );
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
            {files.length > 1
              ? text({ en: `Merging ${files.length} PDF files...`, vi: `Đang gộp ${files.length} tệp PDF...` })
              : text({ en: 'Loading PDF...', vi: 'Đang tải PDF...' })}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {text({ en: 'This may take a moment', vi: 'Quá trình có thể mất một chút thời gian' })}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-600 max-w-sm">
          <HiOutlineExclamationCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">
            {text({ en: 'PDF Loading Error', vi: 'Lỗi tải PDF' })}
          </p>
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
          <p className="text-sm">{text({ en: 'No PDF loaded', vi: 'Chưa có PDF' })}</p>
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
            <span className="text-gray-700 font-medium">
              {text({ en: `${totalPages} pages`, vi: `${totalPages} trang` })}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(pdfUrl, '_blank')
                }
              }}
              className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
              title={text({ en: 'Open in new tab', vi: 'Mở trong tab mới' })}
            >
              <HiOutlineExternalLink className="mr-1" /> {text({ en: 'Open in new tab', vi: 'Mở trong tab mới' })}
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              title={text({ en: 'Hide preview', vi: 'Ẩn xem trước' })}
            >
              {text({ en: 'Close', vi: 'Đóng' })}
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
  const { data: session } = useSession();
  const router = useRouter();
  const { addDraft } = useDraftStore();
  const { startProcessing } = usePdfProcessor();
  const { text } = useTranslation();

  // Mobile redirect
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.replace('/create/mobile');
    }
  }, [router]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  // Redirect if not authenticated
  if (!session) {
    router.push('/login');
    return null;
  }

  // Extract questions from PDF
  const handleExtractQuestions = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError(text({ en: 'Title is required', vi: 'Cần có tiêu đề' }));
      return;
    }

    if (!selectedCategory) {
      setError(text({ en: 'Please select a category', vi: 'Vui lòng chọn danh mục' }));
      return;
    }

    if (pdfFiles.length === 0) {
      setError(text({ en: 'Please upload at least one PDF file', vi: 'Vui lòng tải lên ít nhất một tệp PDF' }));
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

        const data = await extractQuestionsFromPDF(formData);

        setPreviewData(data);
        setEditableTitle(data.title);
        setEditableDescription(data.description);
        setEditableQuestions(data.questions);
      }

    } catch (err: any) {
      console.error('Error extracting questions:', err);
      setError(err.message || text({ en: 'Failed to extract questions from PDF', vi: 'Không thể trích xuất câu hỏi từ PDF' }));
      setShowLargeFileProgress(false);
    } finally {
      setExtracting(false);
    }
  };

  // Create quiz
  const handleCreateQuiz = async () => {
    if (!editableTitle.trim()) {
      setError(text({ en: 'Quiz title is required', vi: 'Cần có tiêu đề quiz' }));
      return;
    }

    if (editableQuestions.length === 0) {
      setError(text({ en: 'At least one question is required', vi: 'Cần ít nhất một câu hỏi' }));
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

      setSuccess(
        result.message ||
          text({
            en: 'Quiz created successfully and sent for approval! Admin will review and approve your quiz.',
            vi: 'Tạo quiz thành công và đã gửi duyệt! Admin sẽ xem xét và phê duyệt quiz của bạn.',
          })
      );

      setTimeout(() => {
        router.push('/pending');
      }, 3000);

    } catch (err: any) {
      console.error('Error creating quiz:', err);
      setError(err.message || text({ en: 'Failed to create quiz', vi: 'Không thể tạo quiz' }));
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
      setError(text({ en: 'Title is required', vi: 'Cần có tiêu đề' }));
      return;
    }

    if (pdfFiles.length === 0) {
      setError(text({ en: 'Please upload at least one PDF file', vi: 'Vui lòng tải lên ít nhất một tệp PDF' }));
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
        fileName = text({
          en: `${pdfFiles.length} merged files`,
          vi: `${pdfFiles.length} tệp đã gộp`,
        });
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
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || text({ en: 'Failed to create draft', vi: 'Không thể tạo bản nháp' }));
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

      toast.success(text({ en: 'Processing started', vi: 'Bắt đầu xử lý' }), {
        description: text({
          en: `${totalPages} pages, ${chunks.total} chunks`,
          vi: `${totalPages} trang, ${chunks.total} phần`,
        }),
      });

      // Navigate to home - DraftSyncProvider will resume processing
      // This prevents the abort that happens when this component unmounts
      router.push('/');

    } catch (err: any) {
      console.error('Error starting background processing:', err);
      setError(err.message || text({ en: 'Failed to start background processing', vi: 'Không thể bắt đầu xử lý nền' }));
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
              <Card variant="bordered" className="border-red-200 bg-red-50 p-4 mb-6 max-w-2xl mx-auto animate-fadeInUp">
                <div className="flex items-center text-red-700">
                  <HiOutlineExclamationCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </Card>
            )}

            {success && (
              <Card variant="bordered" className="border-emerald-200 bg-emerald-50 p-4 mb-6 max-w-2xl mx-auto animate-fadeInUp">
                <div className="flex items-center text-emerald-700">
                  <HiOutlineCheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm font-medium">{success}</span>
                </div>
              </Card>
            )}

            {!previewData ? (
              /* Step 1: Upload Form */
              <Card variant="glass" className="max-w-2xl mx-auto backdrop-blur-xl border-white/30 shadow-xl animate-fadeInUp">
                <CardHeader className="text-center">
                  <CardTitle size="lg" className="text-gray-900">
                    {text({ en: 'Upload PDF Document', vi: 'Tải lên tài liệu PDF' })}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {text({
                      en: 'Choose to process in the background (faster, navigate away) or preview questions first (wait for extraction)',
                      vi: 'Chọn xử lý nền (nhanh hơn, có thể rời trang) hoặc xem trước câu hỏi (chờ trích xuất)',
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <form onSubmit={handleExtractQuestions} className="space-y-6">
                    <div className="space-y-5">
                      <Input
                        label={text({ en: 'Quiz Title', vi: 'Tiêu đề quiz' })}
                        id="title"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={text({ en: 'Enter a descriptive title for your quiz', vi: 'Nhập tiêu đề mô tả cho quiz' })}
                        maxLength={200}
                        variant="glass"
                        icon={
                          <HiOutlineTag className="w-5 h-5" />
                        }
                      />

                      <Textarea
                        label={text({ en: 'Description (Optional)', vi: 'Mô tả (không bắt buộc)' })}
                        id="description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={text({ en: 'Provide additional context about the quiz', vi: 'Cung cấp thêm thông tin về quiz' })}
                        maxLength={1000}
                        variant="glass"
                      />

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          {text({ en: 'Category *', vi: 'Danh mục *' })}
                        </label>
                        <CategorySelector
                          value={selectedCategory}
                          onChange={setSelectedCategory}
                          placeholder={text({ en: 'Search and select a category...', vi: 'Tìm và chọn danh mục...' })}
                          required
                        />
                      </div>

                      {/* Privacy Setting */}
                      <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-xl border border-violet-200">
                        <div className="flex items-start space-x-3">
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
                            <label htmlFor="isPrivateUpload" className="text-sm font-semibold text-gray-900 flex items-center">
                              <HiOutlineLockClosed className="w-4 h-4 mr-1 text-violet-600" />
                              {text({ en: 'Private Quiz', vi: 'Quiz riêng tư' })}
                            </label>
                            <p className="text-xs text-gray-600 mt-1">
                              {text({
                                en: 'Private quizzes are only visible to you and administrators. Perfect for personal study or internal team assessments.',
                                vi: 'Quiz riêng tư chỉ hiển thị cho bạn và quản trị viên. Phù hợp cho học cá nhân hoặc đánh giá nội bộ.',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PDF Upload Section */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        {text({ en: 'PDF Document *', vi: 'Tài liệu PDF *' })}
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
                                  <p className="text-sm font-semibold text-violet-700">
                                    {text({ en: 'Processing files...', vi: 'Đang xử lý tệp...' })}
                                  </p>
                                </div>
                              ) : isDragActive ? (
                                <p className="text-lg font-semibold text-violet-700">
                                  {text({ en: 'Drop PDF files here!', vi: 'Thả tệp PDF vào đây!' })}
                                </p>
                              ) : (
                                <div>
                                  <p className="text-lg font-semibold text-gray-700 mb-2">
                                    <span className="text-violet-600 hover:text-violet-700 transition-colors">
                                      {text({ en: 'Click to upload', vi: 'Bấm để tải lên' })}
                                    </span>{' '}
                                    {text({ en: 'or drag and drop', vi: 'hoặc kéo thả' })}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {text({ en: 'Multiple PDF files allowed, up to 50MB each', vi: 'Cho phép nhiều tệp PDF, tối đa 50MB mỗi tệp' })}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {text({ en: 'Supported formats: .pdf files only', vi: 'Định dạng hỗ trợ: chỉ .pdf' })}
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
                                {text({ en: `Selected Files (${pdfFiles.length})`, vi: `Tệp đã chọn (${pdfFiles.length})` })}
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={removeAllFiles}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <HiOutlineTrash className="w-4 h-4 mr-1" />
                                {text({ en: 'Remove All', vi: 'Xóa tất cả' })}
                              </Button>
                            </div>

                            <div className="space-y-3 max-h-60 overflow-y-auto">
                              {pdfFiles.map((file, index) => (
                                <Card key={index} variant="bordered" className="p-4 hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <div className="p-2 bg-red-100 rounded-xl">
                                        <HiOutlineDocumentText className="h-6 w-6 text-red-600" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900">{file.name}</p>
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
                            {showPDFViewer
                              ? text({ en: 'Hide PDF Preview', vi: 'Ẩn xem trước PDF' })
                              : text({ en: 'Show PDF Preview', vi: 'Hiện xem trước PDF' })}
                          </Button>
                        </div>
                      )}

                      {/* Main Action Buttons */}
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                        <Link href="/">
                          <Button type="button" variant="outline" className="w-full sm:w-auto">
                            <HiOutlineX className="w-4 h-4 mr-2" />
                            {text({ en: 'Cancel', vi: 'Hủy' })}
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
                                {text({ en: 'Creating Draft...', vi: 'Đang tạo bản nháp...' })}
                              </>
                            ) : (
                              <>
                                <HiOutlineArrowRight className="w-4 h-4 mr-2" />
                                {text({ en: 'Create Quiz (Background)', vi: 'Tạo quiz (nền)' })}
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
                                {text({ en: 'Extracting Questions...', vi: 'Đang trích xuất câu hỏi...' })}
                              </>
                            ) : (
                              <>
                                <HiOutlineLightBulb className="w-4 h-4 mr-2" />
                                {text({ en: 'Extract Questions (Preview)', vi: 'Trích xuất câu hỏi (xem trước)' })}
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
                    <CardTitle>{text({ en: 'Quiz Information', vi: 'Thông tin quiz' })}</CardTitle>
                    <CardDescription>
                      {text({ en: 'Edit the title and description for your quiz', vi: 'Chỉnh sửa tiêu đề và mô tả cho quiz' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label htmlFor="editTitle" className="block text-sm font-medium text-gray-700">
                        {text({ en: 'Quiz Title *', vi: 'Tiêu đề quiz *' })}
                      </label>
                      <div className="mt-1">
                        <Input
                          id="editTitle"
                          type="text"
                          required
                          value={editableTitle}
                          onChange={(e) => setEditableTitle(e.target.value)}
                          placeholder={text({ en: 'Enter quiz title', vi: 'Nhập tiêu đề quiz' })}
                          maxLength={200}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700">
                        {text({ en: 'Description', vi: 'Mô tả' })}
                      </label>
                      <div className="mt-1">
                        <Textarea
                          id="editDescription"
                          rows={3}
                          value={editableDescription}
                          onChange={(e) => setEditableDescription(e.target.value)}
                          placeholder={text({ en: 'Enter quiz description', vi: 'Nhập mô tả quiz' })}
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
                        <CardTitle>
                          {text({ en: `Questions (${editableQuestions.length})`, vi: `Câu hỏi (${editableQuestions.length})` })}
                        </CardTitle>
                        <CardDescription>
                          {text({ en: 'Review and edit the questions extracted from your PDF', vi: 'Xem lại và chỉnh sửa câu hỏi trích xuất từ PDF' })}
                        </CardDescription>
                      </div>
                      <Button onClick={addQuestion} size="sm">
                        {text({ en: 'Add Question', vi: 'Thêm câu hỏi' })}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {editableQuestions.map((question, questionIndex) => (
                      <div key={questionIndex} className="border border-gray-200 rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-gray-900">
                            {text({ en: `Question ${questionIndex + 1}`, vi: `Câu ${questionIndex + 1}` })}
                          </h4>
                          <Button
                            onClick={() => removeQuestionLocal(questionIndex)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            {text({ en: 'Remove', vi: 'Xóa' })}
                          </Button>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {text({ en: 'Question Text *', vi: 'Nội dung câu hỏi *' })}
                          </label>
                          <textarea
                            value={question.question}
                            onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder={text({ en: 'Enter the question', vi: 'Nhập câu hỏi' })}
                            required
                          />

                          {/* Question Image Upload */}
                          <div className="mt-3">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              {text({ en: 'Question Image (Optional):', vi: 'Hình ảnh câu hỏi (không bắt buộc):' })}
                            </div>
                            <QuestionImageUpload
                              currentImage={question.questionImage}
                              onImageUploaded={(imageUrl) => updateQuestionImage(questionIndex, imageUrl)}
                              onImageRemoved={() => removeQuestionImage(questionIndex)}
                            />
                          </div>
                        </div>

                        {/* Question Type Selector */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {text({ en: 'Question Type *', vi: 'Loại câu hỏi *' })}
                          </label>
                          <div className="flex space-x-4">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`type-${questionIndex}`}
                                checked={question.type === 'single'}
                                onChange={() => updateQuestionType(questionIndex, 'single')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {text({ en: '📝 Single Choice (one correct answer)', vi: '📝 Một lựa chọn (một đáp án đúng)' })}
                              </span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`type-${questionIndex}`}
                                checked={question.type === 'multiple'}
                                onChange={() => updateQuestionType(questionIndex, 'multiple')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {text({ en: '☑️ Multiple Choice (multiple correct answers)', vi: '☑️ Nhiều lựa chọn (nhiều đáp án đúng)' })}
                              </span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {text({ en: 'Answer Options *', vi: 'Các lựa chọn trả lời *' })}
                            {question.type === 'single'
                              ? text({ en: '(Click radio button to mark correct answer)', vi: '(Chọn radio để đánh dấu đáp án đúng)' })
                              : text({ en: '(Check boxes to mark correct answers)', vi: '(Tích chọn để đánh dấu đáp án đúng)' })
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
                                      title={text({
                                        en: `Mark option ${optionIndex + 1} as correct answer`,
                                        vi: `Đánh dấu lựa chọn ${optionIndex + 1} là đáp án đúng`,
                                      })}
                                    />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => updateMultipleChoice(questionIndex, optionIndex, e.target.checked)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                      title={text({
                                        en: `Mark option ${optionIndex + 1} as correct answer`,
                                        vi: `Đánh dấu lựa chọn ${optionIndex + 1} là đáp án đúng`,
                                      })}
                                    />
                                  )}
                                  <div className="flex-1">
                                    <Input
                                      value={option}
                                      onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                                      placeholder={text({ en: `Option ${optionIndex + 1}`, vi: `Lựa chọn ${optionIndex + 1}` })}
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
                                        {text({ en: '✓ Correct', vi: '✓ Đúng' })}
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
                        {text({
                          en: 'No questions found. Click "Add Question" to create one manually.',
                          vi: 'Không tìm thấy câu hỏi. Bấm "Thêm câu hỏi" để tạo thủ công.',
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <Button onClick={backToUpload} variant="outline" className="w-full sm:w-auto">
                    {text({ en: 'Back to Upload', vi: 'Quay lại tải lên' })}
                  </Button>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {pdfFiles.length > 0 && (
                      <Button
                        onClick={() => setShowPDFViewer(!showPDFViewer)}
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
                      >
                        {showPDFViewer
                          ? text({ en: '📄 Hide PDF Reference', vi: '📄 Ẩn tài liệu PDF' })
                          : text({ en: '📄 Show PDF Reference', vi: '📄 Hiện tài liệu PDF' })}
                      </Button>
                    )}
                    <Button
                      onClick={() => setShowPreviewModal(true)}
                      variant="outline"
                      disabled={editableQuestions.length === 0}
                      className="w-full sm:w-auto"
                    >
                      {text({ en: 'Preview Quiz', vi: 'Xem trước quiz' })}
                    </Button>
                    <Link href="/">
                      <Button variant="outline" className="w-full sm:w-auto">
                        {text({ en: 'Cancel', vi: 'Hủy' })}
                      </Button>
                    </Link>
                    <Button
                      onClick={handleCreateQuiz}
                      loading={creating}
                      disabled={!editableTitle.trim() || editableQuestions.length === 0}
                      className="w-full sm:w-auto"
                    >
                      {creating
                        ? text({ en: 'Creating Quiz...', vi: 'Đang tạo quiz...' })
                        : text({ en: 'Create Quiz', vi: 'Tạo quiz' })}
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
                          <p className="text-sm">
                            {text({ en: 'Upload PDF files to see preview here', vi: 'Tải lên tệp PDF để xem trước ở đây' })}
                          </p>
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
      </main>
    </div>
  );
}
