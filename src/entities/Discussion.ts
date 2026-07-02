import type { UserPreview } from '@/entities/User';

export interface DiscussionComment {
  id: string;
  author: string | UserPreview;
  authorEmail: string;
  content: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Discussion {
  id: string;
  quiz: string;
  questionIndex: number;
  comments: DiscussionComment[];
  createdAt: Date;
  updatedAt: Date;
}
