export interface IBookmarkQuestion {
  text: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface IBookmark {
  _id?: string;
  userId: string;
  userEmail: string;
  quiz: {
    _id: string;
    slug: string;
    title: string;
  };
  question: IBookmarkQuestion;
  questionIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBookmarkRepository {
  findByUserEmail(
    userEmail: string,
    options?: {
      page?: number;
      limit?: number;
    },
  ): Promise<{
    bookmarks: IBookmark[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>;

  findByUserAndQuiz(
    userEmail: string,
    quizSlug: string,
    questionIndex: number,
  ): Promise<IBookmark | null>;

  create(bookmarkData: Partial<IBookmark>): Promise<IBookmark>;

  deleteById(id: string): Promise<boolean>;

  deleteByIdAndUser(id: string, userEmail: string): Promise<boolean>;

  count(filter?: Record<string, unknown>): Promise<number>;
}
