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
  const [isUploading, setIsUploading] = useState(false);

  // File handling
  const onDrop = (acceptedFiles: File[]) => {
    console.log('onDrop called with files:', acceptedFiles);
    setIsUploading(true);
    
    if (!acceptedFiles || acceptedFiles.length === 0) {
      console.log('No accepted files');
      setIsUploading(false);
      return;
    }
    
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    for (const file of acceptedFiles) {
      console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
      
      // Double-check file type (some browsers might not set it correctly)
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        errors.push(`File "${file.name}" is not a PDF file`);
        continue;
      }
      
      if (file.size > 50 * 1024 * 1024) {
        errors.push(`File "${file.name}" is larger than 50MB`);
        continue;
      }
      
      if (file.size === 0) {
        errors.push(`File "${file.name}" is empty`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    // Handle errors
    if (errors.length > 0) {
      setError(errors.join('; '));
      if (validFiles.length === 0) {
        setIsUploading(false);
        return;
      }
    }
    
    // Add valid files
    if (validFiles.length > 0) {
      console.log(`Adding ${validFiles.length} valid files`);
      setPdfFiles(prev => {
        const newFiles = [...prev, ...validFiles];
        console.log('Updated file list:', newFiles.map(f => f.name));
        return newFiles;
      });
      setError('');
      setShowPDFViewer(true);
    } else {
      console.log('No valid files to add');
    }
    
    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024, // 50MB
    onDropRejected: (rejectedFiles) => {
      console.log('Rejected files:', rejectedFiles);
      const reasons = rejectedFiles.map(rejection => {
        const file = rejection.file;
        const errors = rejection.errors.map(error => {
          switch (error.code) {
            case 'file-invalid-type':
              return `File "${file.name}" must be a PDF file`;
            case 'file-too-large':
              return `File "${file.name}" is too large (max 50MB)`;
            case 'too-many-files':
              return 'Too many files selected';
            default:
              return `File "${file.name}": ${error.message}`;
          }
        });
        return errors.join(', ');
      });
      setError(reasons.join('; '));
    },
    onError: (error) => {
      console.error('Dropzone error:', error);
      setError(`Upload error: ${error.message}`);
    }
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
    pdfFiles, setPdfFiles,
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
    isUploading, setIsUploading,
    
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