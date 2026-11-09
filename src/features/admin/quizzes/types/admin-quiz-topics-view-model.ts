/** A topic hub as the admin panel shows it (RIN-1248). */
export interface AdminQuizTopicViewModel {
  id: string;
  slug: string;
  name: string;
  intro: string;
  introWords: number;
  /** 1-based position among topics. */
  order: number;
  published: boolean;
  quizCount: number;
}

export interface AdminQuizTopicQuizViewModel {
  quizId: string;
  /** 1-based position in the topic. */
  order: number;
  /** Null only when the quiz no longer exists. */
  title: string | null;
  questionCount: number;
  /** False when the owner made the quiz private after it was assigned. */
  isPublic: boolean;
}

export interface AdminQuizTopicDetailViewModel {
  topic: AdminQuizTopicViewModel;
  quizzes: AdminQuizTopicQuizViewModel[];
}

export interface AdminQuizTopicFormInput {
  slug: string;
  name: string;
  intro: string;
}

export interface AdminQuizTopicAssignInput {
  topicId: string;
  quizId: string;
  /** 1-based position; omitted means last. */
  order?: number;
}
