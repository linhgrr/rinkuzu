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
      sourceType: draft.source_type,
      isPrivate: draft.is_private,
      revision: draft.revision,
      questionCount: draft.question_count,
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
          ...(question.questionImage ? { questionImage: question.questionImage } : {}),
          ...(question.optionImages?.length
            ? {
                optionImages: question.optionImages.map((image) => image ?? undefined),
              }
            : {}),
        };
        if (question.type === 'single') {
          return { ...base, type: 'single' as const, correctIndex: question.correctIndex ?? 0 };
        }
        return {
          ...base,
          type: 'multiple' as const,
          correctIndexes: question.correctIndexes ?? [],
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
