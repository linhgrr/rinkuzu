import type { QuizDetailDto, QuizQuestionDto } from '@/dtos/quiz';
import type {
  QuizEditViewModel,
  QuizEditorQuestionViewModel,
} from '@/features/quiz/types/quiz-editor-view-model';
import { toQuizDetailBaseViewModel } from '@/features/quiz/mappers/quiz-detail-base.mapper';
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
    ...toQuizDetailBaseViewModel(dto),
    questions: dto.questions.map(toEditorQuestion),
    ...(dto.contentFlags?.personalData === true && {
      personalDataKinds: [...dto.contentFlags.kinds],
    }),
  };
}
