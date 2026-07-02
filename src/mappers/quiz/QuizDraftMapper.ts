import type { QuizDraftTransportDto } from '@/dtos/quiz-draft';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';

export class QuizDraftMapper {
  static toViewModel(draft: QuizDraftTransportDto): QuizDraft {
    return {
      id: draft.draft_id,
      title: draft.title,
      description: draft.description,
      folderId: draft.category_id,
      prompt: draft.prompt,
      pdf: {
        s3Key: draft.pdf.s3_key,
        fileName: draft.pdf.file_name,
        fileSize: draft.pdf.file_size,
        pageCount: draft.pdf.page_count,
      },
      status: draft.status,
      progress: draft.progress,
      questions: draft.questions.map((question) => {
        const base = {
          question: question.question,
          options: question.options,
        };
        if (question.type === 'single') {
          if (question.correctIndex == null) {
            throw new Error('Single-choice draft question is missing correctIndex');
          }
          return { ...base, type: 'single' as const, correctIndex: question.correctIndex };
        }
        if (!question.correctIndexes?.length) {
          throw new Error('Multiple-choice draft question is missing correctIndexes');
        }
        return {
          ...base,
          type: 'multiple' as const,
          correctIndexes: question.correctIndexes,
        };
      }),
      error: draft.error,
      submittedQuizId: draft.submitted_quiz_id,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
      expiresAt: draft.expires_at,
    };
  }
}
