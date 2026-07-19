/** Public discussion author — stable non-PII fields only (no email). */
export interface DiscussionAuthor {
  id: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface DiscussionComment {
  id: string;
  author: DiscussionAuthor;
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
