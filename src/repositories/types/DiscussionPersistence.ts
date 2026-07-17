import type { MongoIdLike } from '@/types/mongo';

interface DiscussionAuthorPersistenceRecord {
  _id: MongoIdLike;
  email: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface DiscussionCommentPersistenceRecord {
  _id: MongoIdLike;
  author: DiscussionAuthorPersistenceRecord;
  content: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionPersistenceRecord {
  _id: MongoIdLike;
  quiz: MongoIdLike;
  questionIndex: number;
  comments: DiscussionCommentPersistenceRecord[];
  createdAt: Date;
  updatedAt: Date;
}
