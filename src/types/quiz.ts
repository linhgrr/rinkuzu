export interface Question {
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

export interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
}

export interface PreviewData {
  title: string;
  description: string;
  questions: Question[];
  originalFileName: string;
  fileSize: number;
  fileCount?: number;
  fileNames?: string[];
}

export interface QuizFormData {
  title: string;
  description: string;
  category: Category | null;
  isPrivate: boolean;
} 