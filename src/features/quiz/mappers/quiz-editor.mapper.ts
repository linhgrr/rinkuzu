import type { QuizDetailDto, QuizQuestionDto } from '@/dtos/quiz';
import type {
  QuizEditViewModel,
  QuizEditorQuestionViewModel,
} from '@/features/quiz/types/quiz-editor-view-model';

function toEditorQuestion(question: QuizQuestionDto, index: number): QuizEditorQuestionViewModel {
  const base = {
    id: question.id,
    editorId: question.id || `loaded-question-${index}`,
    question: question.question,
    options: question.options,
    questionImage: question.questionImage,
    optionImages: question.optionImages,
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
    description: dto.description,
    slug: dto.slug,
    author: dto.author,
    folder: dto.folder,
    isPrivate: dto.isPrivate,
    questionCount: dto.questionCount,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    pdfUrl: dto.pdfUrl,
    tags: dto.tags,
    questions: dto.questions.map(toEditorQuestion),
  };
}
