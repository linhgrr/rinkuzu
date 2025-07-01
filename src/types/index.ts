import { Types } from 'mongoose';

export interface IUser {
  _id: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
}

export interface IQuestion {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number; // For single choice
  correctIndexes?: number[]; // For multiple choice
  questionImage?: string; // URL/path to question image
  optionImages?: (string | undefined)[]; // Array of URLs/paths for option images (parallel to options array)
}

export interface ICategory {
  _id: string;
  name: string;
  description?: string;
  color: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuiz {
  _id: string;
  title: string;
  description?: string;
  category: string | ICategory;
  status: 'pending' | 'published' | 'rejected';
  author: string | IUser;
  slug: string;
  questions: IQuestion[];
  isPrivate: boolean;
  createdAt: Date;
}

export interface IAttempt {
  _id: string;
  user?: string | IUser; // Optional for anonymous attempts
  quiz: string | IQuiz;
  score: number;
  answers: (number | number[])[]; // Support both single and multiple choice
  takenAt: Date;
}

export interface CreateQuizRequest {
  title: string;
  description?: string;
  category: string;
  pdfFiles: File[];
}

export interface QuizAttemptRequest {
  answers: (number | number[])[]; // Support both single and multiple choice
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface QuizFormData {
  title: string;
  description: string;
  category: string;
  pdfFiles: File[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 