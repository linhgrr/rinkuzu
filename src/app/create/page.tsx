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
} from 'react-icons/hi';

// Enhanced PDF Viewer Component with merge capability
function PDFViewerComponent({ files, onClose }: { files: File[]; onClose: () => void }) {
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
      // Dynamic import for PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
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
      console.log('💾 Saving merged PDF...');
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
            {files.length > 1 ? `Merging ${files.length} PDF files...` : 'Loading PDF...'}
          </p>
          <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-600 max-w-sm">
          <HiOutlineExclamationCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">PDF Loading Error</p>
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
          <p className="text-sm">No PDF loaded</p>
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
            <span className="text-gray-700 font-medium">{totalPages} pages</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(pdfUrl, '_blank')
                }
              }}
              className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
              title="Open in new tab"
            >
              <HiOutlineExternalLink className="mr-1" /> Open in new tab
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              title="Hide preview"
            >
              Close
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
      setError('Title is required');
      return;
    }

    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }

    if (pdfFiles.length === 0) {
      setError('Please upload at least one PDF file');
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
      setError(err.message || 'Failed to extract questions from PDF');
      setShowLargeFileProgress(false);
    } finally {
      setExtracting(false);
    }
  };

  // Create quiz
  const handleCreateQuiz = async () => {
    if (!editableTitle.trim()) {
      setError('Quiz title is required');
      return;
    }

    if (editableQuestions.length === 0) {
      setError('At least one question is required');
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

      setSuccess(result.message || 'Quiz created successfully and sent for approval! Admin will review and approve your quiz.');

      setTimeout(() => {
        router.push('/pending');
      }, 3000);

    } catch (err: any) {
      console.error('Error creating quiz:', err);
      setError(err.message || 'Failed to create quiz');
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
                  <CardTitle size="lg" className="text-gray-900">Upload PDF Document</CardTitle>
                  <CardDescription className="text-base">
                    Provide basic information and upload the PDF file to extract questions
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <form onSubmit={handleExtractQuestions} className="space-y-6">
                    <div className="space-y-5">
                      <Input
                        label="Quiz Title"
                        id="title"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter a descriptive title for your quiz"
                        maxLength={200}
                        variant="glass"
                        icon={
                          <HiOutlineTag className="w-5 h-5" />
                        }
                      />

                      <Textarea
                        label="Description (Optional)"
                        id="description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Provide additional context about the quiz"
                        maxLength={1000}
                        variant="glass"
                      />

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Category *
                        </label>
                        <CategorySelector
                          value={selectedCategory}
                          onChange={setSelectedCategory}
                          placeholder="Search and select a category..."
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
                              Private Quiz
                            </label>
                            <p className="text-xs text-gray-600 mt-1">
                              Private quizzes are only visible to you and administrators. Perfect for personal study or internal team assessments.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PDF Upload Section */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        PDF Document *
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
                                  <p className="text-sm font-semibold text-violet-700">Processing files...</p>
                                </div>
                              ) : isDragActive ? (
                                <p className="text-lg font-semibold text-violet-700">Drop PDF files here!</p>
                              ) : (
                                <div>
                                  <p className="text-lg font-semibold text-gray-700 mb-2">
                                    <span className="text-violet-600 hover:text-violet-700 transition-colors">Click to upload</span> or drag and drop
                                  </p>
                                  <p className="text-sm text-gray-500">Multiple PDF files allowed, up to 50MB each</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    Supported formats: .pdf files only
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
                                Selected Files ({pdfFiles.length})
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={removeAllFiles}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <HiOutlineTrash className="w-4 h-4 mr-1" />
                                Remove All
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
                            {showPDFViewer ? 'Hide' : 'Show'} PDF Preview
                          </Button>
                        </div>
                      )}

                      {/* Main Action Buttons */}
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                        <Link href="/">
                          <Button type="button" variant="outline" className="w-full sm:w-auto">
                            <HiOutlineX className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </Link>
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
                              Extracting Questions...
                            </>
                          ) : (
                            <>
                              <HiOutlineLightBulb className="w-4 h-4 mr-2" />
                              Extract Questions from {pdfFiles.length} file{pdfFiles.length !== 1 ? 's' : ''}
                            </>
                          )}
                        </Button>
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
                    <CardTitle>Quiz Information</CardTitle>
                    <CardDescription>
                      Edit the title and description for your quiz
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label htmlFor="editTitle" className="block text-sm font-medium text-gray-700">
                        Quiz Title *
                      </label>
                      <div className="mt-1">
                        <Input
                          id="editTitle"
                          type="text"
                          required
                          value={editableTitle}
                          onChange={(e) => setEditableTitle(e.target.value)}
                          placeholder="Enter quiz title"
                          maxLength={200}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <div className="mt-1">
                        <Textarea
                          id="editDescription"
                          rows={3}
                          value={editableDescription}
                          onChange={(e) => setEditableDescription(e.target.value)}
                          placeholder="Enter quiz description"
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
                        <CardTitle>Questions ({editableQuestions.length})</CardTitle>
                        <CardDescription>
                          Review and edit the questions extracted from your PDF
                        </CardDescription>
                      </div>
                      <Button onClick={addQuestion} size="sm">
                        Add Question
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {editableQuestions.map((question, questionIndex) => (
                      <div key={questionIndex} className="border border-gray-200 rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-gray-900">Question {questionIndex + 1}</h4>
                          <Button
                            onClick={() => removeQuestionLocal(questionIndex)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Question Text *
                          </label>
                          <textarea
                            value={question.question}
                            onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="Enter the question"
                            required
                          />

                          {/* Question Image Upload */}
                          <div className="mt-3">
                            <div className="text-sm font-medium text-gray-700 mb-2">Question Image (Optional):</div>
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
                            Question Type *
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
                                📝 Single Choice (one correct answer)
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
                                ☑️ Multiple Choice (multiple correct answers)
                              </span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Answer Options *
                            {question.type === 'single'
                              ? '(Click radio button to mark correct answer)'
                              : '(Check boxes to mark correct answers)'
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
                                      title={`Mark option ${optionIndex + 1} as correct answer`}
                                    />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => updateMultipleChoice(questionIndex, optionIndex, e.target.checked)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                      title={`Mark option ${optionIndex + 1} as correct answer`}
                                    />
                                  )}
                                  <div className="flex-1">
                                    <Input
                                      value={option}
                                      onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                                      placeholder={`Option ${optionIndex + 1}`}
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
                                        ✓ Correct
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
                        No questions found. Click "Add Question" to create one manually.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <Button onClick={backToUpload} variant="outline" className="w-full sm:w-auto">
                    Back to Upload
                  </Button>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {pdfFiles.length > 0 && (
                      <Button
                        onClick={() => setShowPDFViewer(!showPDFViewer)}
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
                      >
                        📄 {showPDFViewer ? 'Hide' : 'Show'} PDF Reference
                      </Button>
                    )}
                    <Button
                      onClick={() => setShowPreviewModal(true)}
                      variant="outline"
                      disabled={editableQuestions.length === 0}
                      className="w-full sm:w-auto"
                    >
                      Preview Quiz
                    </Button>
                    <Link href="/">
                      <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
                    </Link>
                    <Button
                      onClick={handleCreateQuiz}
                      loading={creating}
                      disabled={!editableTitle.trim() || editableQuestions.length === 0}
                      className="w-full sm:w-auto"
                    >
                      {creating ? 'Creating Quiz...' : 'Create Quiz'}
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
                          <p className="text-sm">Upload PDF files to see preview here</p>
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