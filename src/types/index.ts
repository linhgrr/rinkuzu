import type { IQuestion } from '@/models/Quiz';

export interface IUserPreview {
  _id: string;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface IUser {
  _id: string;
  email: string;
  password: string;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  createdAt?: Date;
}

/** Internal helper for IQuiz; not exported directly. */
interface ICategory {
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
  author: string | IUser | IUserPreview;
  slug: string;
  questions: IQuestion[];
  isPrivate: boolean;
  createdAt: Date;
}

/** Pagination metadata returned by list endpoints (attempts, bookmarks, etc.). */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
