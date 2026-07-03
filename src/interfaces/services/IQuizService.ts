import type {
  CreateQuizRequestDto,
  DeleteQuizProgressResponseDto,
  FlashcardQuizDto,
  QuizAttemptResultDto,
  QuizDiscussionDto,
  QuizDetailDto,
  QuizListDto,
  QuizListItemDto,
  QuizListOptionsDto,
  QuizPlayDetailDto,
  QuizProgressResponseDto,
  ReportQuizResponseDto,
  SavedQuizProgressDto,
  SaveQuizProgressResponseDto,
  UpdateQuizRequestDto,
} from '@/dtos/quiz';
import type { DeleteResultDto } from '@/dtos/common';
import { ServiceResult } from '@/interfaces/services/types';
import type { Session } from 'next-auth';

export interface IQuizService {
  getQuizzes(options: QuizListOptionsDto): Promise<QuizListDto>;

  createQuiz(userId: string, quizData: CreateQuizRequestDto): Promise<QuizDetailDto>;

  createQuizFromDraft(
    userId: string,
    sourceDraftId: string,
    quizData: CreateQuizRequestDto,
  ): Promise<QuizDetailDto>;

  getQuizById(
    id: string,
    userEmail?: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<QuizDetailDto>>;

  getQuizMetadataBySlug(slug: string): Promise<QuizListItemDto | null>;

  getQuizForPlay(
    slug: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<QuizPlayDetailDto>>;

  getSavedQuizProgress(
    slug: string,
    userId: string,
  ): Promise<ServiceResult<QuizProgressResponseDto>>;

  saveQuizProgress(
    slug: string,
    userId: string,
    progress: SavedQuizProgressDto,
  ): Promise<ServiceResult<SaveQuizProgressResponseDto>>;

  deleteSavedQuizProgress(
    slug: string,
    userId: string,
  ): Promise<ServiceResult<DeleteQuizProgressResponseDto>>;

  updateQuiz(
    id: string,
    quizData: UpdateQuizRequestDto,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizDetailDto>>;

  deleteQuiz(
    id: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<DeleteResultDto>>;

  submitQuizAttempt(
    slug: string,
    answers: (number | number[])[],
    session: Session | null,
    userEmail?: string,
  ): Promise<ServiceResult<QuizAttemptResultDto>>;

  getQuizDiscussions(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto[]>>;

  addDiscussionComment(
    slug: string,
    questionIndex: number,
    content: string,
    userEmail: string,
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto>>;

  getQuizForFlashcards(
    slug: string,
    session: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDto>>;

  reportQuiz(
    slug: string,
    content: string,
    reporterEmail: string,
    reporterName: string,
  ): Promise<ServiceResult<ReportQuizResponseDto>>;
}
