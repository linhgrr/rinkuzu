import type { QuizEditorQuestionViewModel } from '@/features/quiz/types/quiz-editor-view-model';
import {
  addQuestion,
  createEmptyEditorQuestion,
  removeQuestionAt,
  setSingleCorrect,
  toggleMultipleCorrect,
  toggleQuestionType,
  updateOption,
  updateOptionImage,
  updateQuestionField,
  updateQuestionImage,
  type EditableQuestionField,
} from '@/features/quiz/lib/question-editor-mutations';

/**
 * Shared editable form state for draft publish + published quiz edit.
 * Load/save/ACL stay in page adapters; mutations live here.
 */
export interface QuizEditorWorkspaceState {
  questions: QuizEditorQuestionViewModel[];
  title: string;
  description: string;
  isPrivate: boolean;
  selectedFolderId: string | null;
  showPDFViewer: boolean;
  questionToRemove: number | null;
  isSubmitting: boolean;
}

export type QuizEditorWorkspaceAction =
  | { type: 'setTitle'; value: string }
  | { type: 'setDescription'; value: string }
  | { type: 'setIsPrivate'; value: boolean }
  | { type: 'setSelectedFolder'; value: string | null }
  | { type: 'setShowPDFViewer'; value: boolean }
  | { type: 'togglePdfViewer' }
  | { type: 'setQuestionToRemove'; value: number | null }
  | { type: 'setSubmitting'; value: boolean }
  | {
      type: 'updateQuestionField';
      index: number;
      field: EditableQuestionField;
      value: QuizEditorQuestionViewModel[EditableQuestionField];
    }
  | { type: 'updateOption'; questionIndex: number; optionIndex: number; value: string }
  | { type: 'updateQuestionImage'; questionIndex: number; value?: string }
  | { type: 'updateOptionImage'; questionIndex: number; optionIndex: number; value?: string }
  | { type: 'addQuestion' }
  | { type: 'removeQuestion'; index: number }
  | { type: 'toggleQuestionType'; index: number; value: 'single' | 'multiple' }
  | { type: 'setSingleCorrect'; questionIndex: number; optionIndex: number }
  | { type: 'toggleMultipleCorrect'; questionIndex: number; optionIndex: number; checked: boolean };

export function createQuizEditorWorkspaceState(input: {
  questions: QuizEditorQuestionViewModel[];
  title: string;
  description?: string | null;
  isPrivate?: boolean;
  selectedFolderId?: string | null;
  showPDFViewer?: boolean;
}): QuizEditorWorkspaceState {
  return {
    questions: input.questions,
    title: input.title,
    description: input.description ?? '',
    isPrivate: input.isPrivate ?? false,
    selectedFolderId: input.selectedFolderId ?? null,
    showPDFViewer: input.showPDFViewer ?? true,
    questionToRemove: null,
    isSubmitting: false,
  };
}

export function quizEditorWorkspaceReducer(
  state: QuizEditorWorkspaceState,
  action: QuizEditorWorkspaceAction,
): QuizEditorWorkspaceState {
  switch (action.type) {
    case 'setTitle':
      return { ...state, title: action.value };
    case 'setDescription':
      return { ...state, description: action.value };
    case 'setIsPrivate':
      return { ...state, isPrivate: action.value };
    case 'setSelectedFolder':
      return { ...state, selectedFolderId: action.value };
    case 'setShowPDFViewer':
      return { ...state, showPDFViewer: action.value };
    case 'togglePdfViewer':
      return { ...state, showPDFViewer: !state.showPDFViewer };
    case 'setQuestionToRemove':
      return { ...state, questionToRemove: action.value };
    case 'setSubmitting':
      return { ...state, isSubmitting: action.value };
    case 'updateQuestionField':
      return {
        ...state,
        questions: updateQuestionField(state.questions, action.index, action.field, action.value),
      };
    case 'updateOption':
      return {
        ...state,
        questions: updateOption(
          state.questions,
          action.questionIndex,
          action.optionIndex,
          action.value,
        ),
      };
    case 'updateQuestionImage':
      return {
        ...state,
        questions: updateQuestionImage(state.questions, action.questionIndex, action.value),
      };
    case 'updateOptionImage':
      return {
        ...state,
        questions: updateOptionImage(
          state.questions,
          action.questionIndex,
          action.optionIndex,
          action.value,
        ),
      };
    case 'addQuestion':
      return {
        ...state,
        questions: addQuestion(
          state.questions,
          createEmptyEditorQuestion(`q-new-${crypto.randomUUID()}`),
        ),
      };
    case 'removeQuestion':
      return {
        ...state,
        questions: removeQuestionAt(state.questions, action.index),
        questionToRemove: null,
      };
    case 'toggleQuestionType':
      return {
        ...state,
        questions: toggleQuestionType(state.questions, action.index, action.value),
      };
    case 'setSingleCorrect':
      return {
        ...state,
        questions: setSingleCorrect(state.questions, action.questionIndex, action.optionIndex),
      };
    case 'toggleMultipleCorrect':
      return {
        ...state,
        questions: toggleMultipleCorrect(
          state.questions,
          action.questionIndex,
          action.optionIndex,
          action.checked,
        ),
      };
    default:
      return state;
  }
}
