'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { QuizPreviewModal } from '@/components/ui/QuizPreviewModal';
import { QuestionImage, OptionImage } from '@/components/ui/ImageDisplay';
import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { CategorySelector } from '@/components/ui/CategorySelector';


interface Question {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number; // For single choice
  correctIndexes?: number[]; // For multiple choice
  // Image support
  questionImage?: string; // URL/path to question image
  optionImages?: (string | undefined)[]; // Array of URLs/paths for option images
  // Legacy fields for backward compatibility during transition
  correctAnswer?: number;
}

interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
}

interface PreviewData {
  title: string;
  description: string;
  questions: Question[];
  originalFileName: string;
  fileSize: number;
  fileCount?: number;
  fileNames?: string[];
}

export default function CreateQuizPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // Step 1: Upload form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  
  // Step 2: Preview and edit
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [editableQuestions, setEditableQuestions] = useState<Question[]>([]);
  const [creating, setCreating] = useState(false);
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // PDF viewer state
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  
  // Image processing state

  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if not authenticated
  if (!session) {
    router.push('/login');
    return null;
  }

  const onDrop = (acceptedFiles: File[]) => {
    const validFiles: File[] = [];
    
    for (const file of acceptedFiles) {
      if (file.type !== 'application/pdf') {
        setError(`File "${file.name}" is not a PDF file`);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(`File "${file.name}" is larger than 20MB`);
        return;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      setPdfFiles(prev => [...prev, ...validFiles]);
      setError('');
      // Auto-show PDF viewer when files are added
      setShowPDFViewer(true);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  // Step 1: Extract questions from PDF
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
    


    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      
      // Append all PDF files
      pdfFiles.forEach((file, index) => {
        formData.append(`pdfFile_${index}`, file);
      });
      formData.append('fileCount', pdfFiles.length.toString());



      const response = await fetch('/api/quizzes/preview', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(300000), // 5 minutes timeout
      });

      const data = await response.json();

      if (data.success) {

        
        console.log('🎯 Preview data received:', data.data);
        console.log('📋 Questions from API:', data.data.questions);
        
        if (data.data.questions && data.data.questions.length > 0) {
          data.data.questions.forEach((q: any, index: number) => {
            console.log(`❓ Question ${index + 1}:`, {
              question: q.question?.substring(0, 50) + '...',
              options: q.options,
              correctAnswer: q.correctAnswer,
              correctAnswerType: typeof q.correctAnswer,
              correctIndex: q.correctIndex,
              originalCorrectIndex: q.originalCorrectIndex,
              fullQuestion: q
            });
          });
        }

        // Ensure correctAnswer is properly set for each question
        const processedQuestions = data.data.questions.map((q: any, index: number) => {
          // Initialize question with type detection
          const questionType = q.type || 'single'; // Default to single if not specified
          let processedQuestion: Question = {
            question: q.question,
            options: q.options,
            type: questionType
          };

          if (questionType === 'single') {
            let finalCorrectAnswer = q.correctAnswer;
            
            // Fallback logic if correctAnswer is undefined
            if (typeof finalCorrectAnswer === 'undefined') {
              if (typeof q.correctIndex === 'number') {
                finalCorrectAnswer = q.correctIndex;
              } else if (typeof q.originalCorrectIndex === 'number') {
                finalCorrectAnswer = q.originalCorrectIndex;
              } else {
                finalCorrectAnswer = 0; // Default to first option
              }
            }
            
            processedQuestion.correctIndex = finalCorrectAnswer;
            processedQuestion.correctAnswer = finalCorrectAnswer; // Keep for backward compatibility
            
            console.log(`🔧 Processed single choice Question ${index + 1}: correctIndex=${finalCorrectAnswer}`);
          } else if (questionType === 'multiple') {
            // Handle multiple choice questions - check multiple sources
            let finalCorrectIndexes = [];
            
            // Priority order: correctIndexes -> originalCorrectIndexes -> empty array
            if (Array.isArray(q.correctIndexes) && q.correctIndexes.length > 0) {
              finalCorrectIndexes = q.correctIndexes;
              console.log(`🔧 Using correctIndexes: ${JSON.stringify(finalCorrectIndexes)}`);
            } else if (Array.isArray(q.originalCorrectIndexes) && q.originalCorrectIndexes.length > 0) {
              finalCorrectIndexes = q.originalCorrectIndexes;
              console.log(`🔧 Using originalCorrectIndexes: ${JSON.stringify(finalCorrectIndexes)}`);
            } else {
              console.warn(`⚠️ No correct indexes found for multiple choice Question ${index + 1}, defaulting to empty array`);
            }
            
            processedQuestion.correctIndexes = finalCorrectIndexes;
            console.log(`✅ Processed multiple choice Question ${index + 1}: correctIndexes=${JSON.stringify(finalCorrectIndexes)}`);
          }
          
          return processedQuestion;
        });
        
        setPreviewData(data.data);
        setEditableTitle(data.data.title);
        setEditableDescription(data.data.description);
        setEditableQuestions(processedQuestions);
      } else {
        setError(data.error || 'Failed to extract questions from PDF');
      }
    } catch (error) {
      setError('An error occurred while processing the PDF');
    } finally {
      setExtracting(false);
    }
  };

  // Step 2: Create quiz with edited data
  const handleCreateQuiz = async () => {
    if (!editableTitle.trim()) {
      setError('Title is required');
      return;
    }

    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }

    if (!editableQuestions || editableQuestions.length === 0) {
      setError('At least one question is required');
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      // Convert questions to proper IQuestion format
      const formattedQuestions = editableQuestions.map((q: Question, idx: number) => {
        console.log(`📝 Processing Question ${idx + 1}:`, {
          hasQuestionImage: !!q.questionImage,
          optionImagesCount: q.optionImages?.filter(Boolean).length || 0,
          questionImage: q.questionImage,
          optionImages: q.optionImages
        });

        const base = {
          question: q.question,
          options: q.options,
          type: q.type,
          // include images only if at least one exists
          ...(q.questionImage ? { questionImage: q.questionImage } : {}),
          ...(q.optionImages && q.optionImages.some(Boolean) ? { optionImages: q.optionImages } : {})
        } as any;

        if (q.type === 'single') {
          return {
            ...base,
            correctIndex: q.correctIndex ?? 0
          };
        }
        return {
          ...base,
          correctIndexes: q.correctIndexes || []
        };
      });

      console.log('📤 Sending questions to API:', formattedQuestions.map((q, i) => ({
        index: i + 1,
        type: q.type,
        correctIndex: 'correctIndex' in q ? q.correctIndex : undefined,
        correctIndexes: 'correctIndexes' in q ? q.correctIndexes : undefined
      })));

      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editableTitle.trim(),
          description: editableDescription.trim(),
          category: selectedCategory._id,
          questions: formattedQuestions,
        }),
        signal: AbortSignal.timeout(60000), // 1 minute timeout
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Quiz created successfully and sent for admin approval!');
        setTimeout(() => {
          router.push('/pending');
        }, 2000);
      } else {
        setError(data.error || 'Failed to create quiz');
      }
    } catch (error) {
      setError('An error occurred while creating the quiz');
    } finally {
      setCreating(false);
    }
  };

  const removeFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllFiles = () => {
    setPdfFiles([]);
  };

  const backToUpload = () => {
    setPreviewData(null);
    setEditableTitle('');
    setEditableDescription('');
    setEditableQuestions([]);
    setError('');
    setSuccess('');
    // Keep category selection when going back
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...editableQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditableQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...editableQuestions];
    updated[questionIndex].options[optionIndex] = value;
    setEditableQuestions(updated);
  };

  const updateQuestionImage = (questionIndex: number, imageUrl: string) => {
    console.log(`📸 Updating question ${questionIndex + 1} image:`, imageUrl);
    const updated = [...editableQuestions];
    updated[questionIndex] = { ...updated[questionIndex], questionImage: imageUrl };
    setEditableQuestions(updated);
    console.log(`✅ Question ${questionIndex + 1} image updated in state`);
  };

  const removeQuestionImage = (questionIndex: number) => {
    const updated = [...editableQuestions];
    updated[questionIndex] = { ...updated[questionIndex], questionImage: undefined };
    setEditableQuestions(updated);
  };

  const updateOptionImage = (questionIndex: number, optionIndex: number, imageUrl: string) => {
    console.log(`📸 Updating question ${questionIndex + 1}, option ${optionIndex + 1} image:`, imageUrl);
    const updated = [...editableQuestions];
    if (!updated[questionIndex].optionImages) {
      updated[questionIndex].optionImages = new Array(updated[questionIndex].options.length).fill(undefined);
    }
    updated[questionIndex].optionImages![optionIndex] = imageUrl;
    setEditableQuestions(updated);
    console.log(`✅ Question ${questionIndex + 1}, option ${optionIndex + 1} image updated in state`);
  };

  const removeOptionImage = (questionIndex: number, optionIndex: number) => {
    const updated = [...editableQuestions];
    if (updated[questionIndex].optionImages) {
      updated[questionIndex].optionImages![optionIndex] = undefined;
    }
    setEditableQuestions(updated);
  };

  const addQuestion = () => {
    setEditableQuestions([
      ...editableQuestions,
      {
        question: '',
        options: ['', '', '', ''],
        type: 'single',
        correctIndex: 0,
        correctIndexes: []
      }
    ]);
  };

  const removeQuestion = (index: number) => {
    setEditableQuestions(editableQuestions.filter((_, i) => i !== index));
  };

  const updateQuestionType = (index: number, type: 'single' | 'multiple') => {
    const updated = [...editableQuestions];
    updated[index] = { 
      ...updated[index], 
      type,
      correctIndex: type === 'single' ? (updated[index].correctIndex || 0) : undefined,
      correctIndexes: type === 'multiple' ? (updated[index].correctIndexes || []) : undefined,
      correctAnswer: undefined // Remove legacy field
    };
    setEditableQuestions(updated);
  };

  const updateSingleChoice = (questionIndex: number, optionIndex: number) => {
    const updated = [...editableQuestions];
    updated[questionIndex] = {
      ...updated[questionIndex],
      correctIndex: optionIndex
    };
    setEditableQuestions(updated);
  };

  const updateMultipleChoice = (questionIndex: number, optionIndex: number, checked: boolean) => {
    const updated = [...editableQuestions];
    const currentIndexes = updated[questionIndex].correctIndexes || [];
    
    if (checked) {
      updated[questionIndex].correctIndexes = [...currentIndexes, optionIndex].sort();
    } else {
      updated[questionIndex].correctIndexes = currentIndexes.filter(idx => idx !== optionIndex);
    }
    setEditableQuestions(updated);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
                          <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
            </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost">Home</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Home</Button>
              </Link>
              <Link href="/pending">
                <Button variant="outline">My Quizzes</Button>
              </Link>
              {(session.user as any)?.role === 'admin' && (
                <Link href="/admin/queue">
                  <Button variant="outline">Admin Queue</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ${showPDFViewer ? 'lg:mr-[30vw]' : ''}`}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Quiz</h1>
          <p className="mt-2 text-gray-600">
            {!previewData 
              ? 'Upload a PDF document and let AI extract questions automatically'
              : 'Review and edit the questions before creating your quiz'
            }
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4 mb-6">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        {!previewData ? (
          // Step 1: Upload Form
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Upload PDF Document</CardTitle>
              <CardDescription>
                Provide basic information and upload the PDF file to extract questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleExtractQuestions} className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Quiz Title *
                  </label>
                  <div className="mt-1">
                    <Input
                      id="title"
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter a descriptive title for your quiz"
                      maxLength={200}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description (Optional)
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="description"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide additional context about the quiz"
                      maxLength={1000}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <CategorySelector
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    placeholder="Search and select a category..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDF Document *
                  </label>
                  

                  
                  <div>
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        isDragActive
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="space-y-2">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="text-sm text-gray-600">
                          {isDragActive ? (
                            <p>Drop PDF files here...</p>
                          ) : (
                            <p>
                              <span className="font-medium text-blue-600">Click to upload</span> or
                              drag and drop
                            </p>
                          )}
                          <p className="text-xs">Multiple PDF files allowed, up to 20MB each</p>
                        </div>
                      </div>
                    </div>
                    
                    {pdfFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-700">
                            Selected Files ({pdfFiles.length})
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeAllFiles}
                            className="text-red-600"
                          >
                            Remove All
                          </Button>
                        </div>
                        
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {pdfFiles.map((file, index) => (
                            <div key={index} className="border border-gray-300 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <svg
                                    className="h-6 w-6 text-red-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
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
                                  className="text-red-600"
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <div>
                    {pdfFiles.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowPDFViewer(!showPDFViewer)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        📄 {showPDFViewer ? 'Hide' : 'Show'} PDF Preview
                      </Button>
                    )}
                  </div>
                  <div className="flex space-x-4">
                    <Link href="/">
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      loading={extracting}
                      disabled={!title.trim() || !selectedCategory || pdfFiles.length === 0}
                    >
                      {extracting ? 'Extracting Questions...' : `Extract Questions from ${pdfFiles.length} file${pdfFiles.length !== 1 ? 's' : ''}`}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          // Step 2: Preview and Edit
          <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ${showPDFViewer ? 'lg:mr-[15vw]' : ''}`}>
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
                    <textarea
                      id="editDescription"
                      rows={3}
                      value={editableDescription}
                      onChange={(e) => setEditableDescription(e.target.value)}
                      placeholder="Enter quiz description"
                      maxLength={1000}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  {previewData.fileCount && previewData.fileCount > 1 ? (
                    <div>
                      <div className="font-medium">
                        Original files ({previewData.fileCount}): 
                      </div>
                      <div className="mt-1">
                        {previewData.fileNames?.map((fileName, index) => (
                          <div key={index} className="text-xs ml-2">
                            • {fileName}
                          </div>
                        )) || previewData.originalFileName}
                      </div>
                      <div className="mt-1">
                        Total size: {(previewData.fileSize / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  ) : (
                    <div>
                      Original file: {previewData.originalFileName} ({(previewData.fileSize / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  )}
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
                      Review and edit the questions extracted from your PDF{previewData.fileCount && previewData.fileCount > 1 ? 's' : ''}
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
                        onClick={() => removeQuestion(questionIndex)}
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
                            <div key={optionIndex} className={`flex items-center space-x-2 p-2 rounded-lg border ${
                              isSelected 
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
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => updateMultipleChoice(questionIndex, optionIndex, e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                      <div className="mt-2 text-xs text-gray-500">
                        {question.type === 'single' ? (
                          `Current correct answer: ${
                            typeof question.correctIndex === 'number' && 
                            question.correctIndex >= 0 && 
                            question.correctIndex < question.options.length
                              ? `Option ${String.fromCharCode(65 + question.correctIndex)} (${question.options[question.correctIndex]})`
                              : 'Not set or invalid'
                          }`
                        ) : (
                          `Correct answers: ${
                            (question.correctIndexes || []).length > 0
                              ? (question.correctIndexes || [])
                                  .map(idx => `${String.fromCharCode(65 + idx)} (${question.options[idx]})`)
                                  .join(', ')
                              : 'None selected'
                          }`
                        )}
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
            <div className="flex justify-between">
              <Button onClick={backToUpload} variant="outline">
                Back to Upload
              </Button>
              <div className="flex items-center space-x-4">
                {pdfFiles.length > 0 && (
                  <Button
                    onClick={() => setShowPDFViewer(!showPDFViewer)}
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    📄 {showPDFViewer ? 'Hide' : 'Show'} PDF Reference
                  </Button>
                )}
                <Button 
                  onClick={() => setShowPreviewModal(true)} 
                  variant="outline"
                  disabled={editableQuestions.length === 0}
                >
                  Preview Quiz
                </Button>
                <Link href="/">
                  <Button variant="outline">Cancel</Button>
                </Link>
                <Button
                  onClick={handleCreateQuiz}
                  loading={creating}
                  disabled={!editableTitle.trim() || editableQuestions.length === 0}
                >
                  {creating ? 'Creating Quiz...' : 'Create Quiz'}
                </Button>
              </div>
            </div>
          </div>
        )}

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

        {/* PDF Viewer - Sticky on the right side */}
        <PDFViewer
          pdfFiles={pdfFiles}
          isVisible={showPDFViewer}
          onToggle={() => setShowPDFViewer(!showPDFViewer)}
        />

      </main>
    </div>
  );
} 