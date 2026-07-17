import type { AttemptAnswer } from '@/entities/Attempt';
import type { QuizQuestion } from '@/entities/Quiz';
import type { WrongQuizAttemptQuestion } from '@/entities/QuizAttempt';

interface AttemptQuizSnapshotData {
  integrity: 'complete';
  title: string;
  slug: string;
  description?: string;
  questions: QuizQuestion[];
}

interface QuizAttemptSubmissionData {
  idempotencyKey: string;
  quizId: string;
  quizSlug: string;
  quizSnapshot: AttemptQuizSnapshotData;
  answers: AttemptAnswer[];
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongQuestions: WrongQuizAttemptQuestion[];
  takenAt: Date;
}

export type RecordQuizAttemptProgressData =
  | (QuizAttemptSubmissionData & {
      userId: string;
      guestEmail?: never;
    })
  | (QuizAttemptSubmissionData & {
      userId?: never;
      guestEmail: string;
    });

export interface RecordedQuizAttempt {
  id: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
}

export interface IQuizAttemptProgressRepository {
  recordSubmittedAttempt(data: RecordQuizAttemptProgressData): Promise<RecordedQuizAttempt>;
}
