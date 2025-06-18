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
}

export interface IQuiz {
  _id: string;
  title: string;
  description?: string;
  status: 'pending' | 'published' | 'rejected';
  author: string | IUser;
  slug: string;
  questions: IQuestion[];
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
  pdfFile: File;
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
  role?: 'admin' | 'user';
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
  pdfFile: File | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 