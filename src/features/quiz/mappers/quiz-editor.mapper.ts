import type { QuizDetailDto, QuizQuestionDto } from '@/dtos/quiz';
import type {
  QuizEditViewModel,
  QuizEditorQuestionViewModel,
} from '@/features/quiz/types/quiz-editor-view-model';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';

function toEditorQuestion(question: QuizQuestionDto, index: number): QuizEditorQuestionViewModel {
  const base = {
    ...copyQuizQuestionFields(question),
    editorId: question.id || `loaded-question-${index}`,
  };

  return question.type === 'single'
    ? {
        ...base,
        type: 'single',
        correctIndex: question.correctIndex,
      }
    : {
        ...base,
        type: 'multiple',
        correctIndexes: question.correctIndexes,
      };
}

export function toQuizEditViewModel(dto: QuizDetailDto): QuizEditViewModel {
  return {
    id: dto.id,
    title: dto.title,
    ...(dto.description !== undefined && { description: dto.description }),
    slug: dto.slug,
    author: dto.author,
    folder: dto.folder,
    isPrivate: dto.isPrivate,
    questionCount: dto.questionCount,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    ...(dto.pdfUrl !== undefined && { pdfUrl: dto.pdfUrl }),
    ...(dto.tags !== undefined && { tags: dto.tags }),
    questions: dto.questions.map(toEditorQuestion),
  };
}
