import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Question, Category, PreviewData } from '@/types/quiz';

export function useQuizCreation() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // Step 1: Upload form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  
  // Step 2: Preview and edit state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [editableQuestions, setEditableQuestions] = useState<Question[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // UI state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // File handling
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

  const removeFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllFiles = () => {
    setPdfFiles([]);
    setShowPDFViewer(false);
  };

  // Question management
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
    const updated = [...editableQuestions];
    updated[questionIndex] = {
      ...updated[questionIndex],
      questionImage: imageUrl
    };
    setEditableQuestions(updated);
  };

  const removeQuestionImage = (questionIndex: number) => {
    const updated = [...editableQuestions];
    updated[questionIndex] = {
      ...updated[questionIndex],
      questionImage: undefined
    };
    setEditableQuestions(updated);
  };

  const updateOptionImage = (questionIndex: number, optionIndex: number, imageUrl: string) => {
    const updated = [...editableQuestions];
    if (!updated[questionIndex].optionImages) {
      updated[questionIndex].optionImages = [];
    }
    const optionImages = [...(updated[questionIndex].optionImages || [])];
    optionImages[optionIndex] = imageUrl;
    updated[questionIndex].optionImages = optionImages;
    setEditableQuestions(updated);
  };

  const removeOptionImage = (questionIndex: number, optionIndex: number) => {
    const updated = [...editableQuestions];
    if (updated[questionIndex].optionImages) {
      const optionImages = [...updated[questionIndex].optionImages!];
      optionImages[optionIndex] = undefined;
      updated[questionIndex].optionImages = optionImages;
      setEditableQuestions(updated);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      question: '',
      options: ['', '', '', ''],
      type: 'single',
      correctIndex: 0
    };
    setEditableQuestions(prev => [...prev, newQuestion]);
  };

  const removeQuestion = (index: number) => {
    setEditableQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuestionType = (index: number, type: 'single' | 'multiple') => {
    const updated = [...editableQuestions];
    updated[index] = {
      ...updated[index],
      type,
      correctIndex: type === 'single' ? 0 : undefined,
      correctIndexes: type === 'multiple' ? [] : undefined
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

  const backToUpload = () => {
    setPreviewData(null);
    setEditableTitle('');
    setEditableDescription('');
    setEditableQuestions([]);
    setIsPrivate(false);
    setError('');
    setSuccess('');
  };

  return {
    // Session data
    session,
    router,
    
    // Form state
    title, setTitle,
    description, setDescription,
    selectedCategory, setSelectedCategory,
    pdfFiles,
    extracting, setExtracting,
    
    // Preview state
    previewData, setPreviewData,
    editableTitle, setEditableTitle,
    editableDescription, setEditableDescription,
    editableQuestions, setEditableQuestions,
    isPrivate, setIsPrivate,
    creating, setCreating,
    
    // UI state
    showPreviewModal, setShowPreviewModal,
    showPDFViewer, setShowPDFViewer,
    error, setError,
    success, setSuccess,
    
    // File handling
    getRootProps,
    getInputProps,
    isDragActive,
    removeFile,
    removeAllFiles,
    
    // Question management
    updateQuestion,
    updateOption,
    updateQuestionImage,
    removeQuestionImage,
    updateOptionImage,
    removeOptionImage,
    addQuestion,
    removeQuestion,
    updateQuestionType,
    updateSingleChoice,
    updateMultipleChoice,
    backToUpload
  };
} 