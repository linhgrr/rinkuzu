import type {
  QuizEditorQuestionViewModel,
  QuizVisibilityViewModel,
} from '@/features/quiz/types/quiz-editor-view-model';
import type { QuestionType } from '@/shared/constants/question-type';
import {
  addOption,
  addQuestion,
  createEmptyEditorQuestion,
  insertQuestion,
  removeQuestionAt,
  removeOption,
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
  submitToPremium: boolean;
  /** The owner's choice, kept while Premium (which forces private) is ticked. */
  visibility: QuizVisibilityViewModel;
  selectedFolderId: string | null;
  showPDFViewer: boolean;
  questionToRemove: number | null;
  isSubmitting: boolean;
}

export type QuizEditorWorkspaceAction =
  | { type: 'setTitle'; value: string }
  | { type: 'setDescription'; value: string }
  | { type: 'setSubmitToPremium'; value: boolean }
  | { type: 'setVisibility'; value: QuizVisibilityViewModel }
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
  | { type: 'addOption'; questionIndex: number }
  | { type: 'removeOption'; questionIndex: number; optionIndex: number }
  | { type: 'updateQuestionImage'; questionIndex: number; value?: string }
  | { type: 'updateOptionImage'; questionIndex: number; optionIndex: number; value?: string }
  | { type: 'addQuestion'; editorId: string }
  | { type: 'insertQuestion'; index: number; editorId: string }
  | { type: 'removeQuestion'; index: number }
  | { type: 'toggleQuestionType'; index: number; value: QuestionType }
  | { type: 'setSingleCorrect'; questionIndex: number; optionIndex: number }
  | { type: 'toggleMultipleCorrect'; questionIndex: number; optionIndex: number; checked: boolean };

export function createQuizEditorWorkspaceState(input: {
  questions: QuizEditorQuestionViewModel[];
  title: string;
  description?: string | null;
  submitToPremium?: boolean;
  visibility?: QuizVisibilityViewModel;
  selectedFolderId?: string | null;
  showPDFViewer?: boolean;
}): QuizEditorWorkspaceState {
  return {
    questions: input.questions,
    title: input.title,
    description: input.description ?? '',
    submitToPremium: input.submitToPremium ?? false,
    visibility: input.visibility ?? 'personal',
    selectedFolderId: input.selectedFolderId ?? null,
    showPDFViewer: input.showPDFViewer ?? true,
    questionToRemove: null,
    isSubmitting: false,
  };
}

/** What a save sends: a Premium submission is always private (RIN-1271). */
export function effectiveQuizVisibility(
  state: Pick<QuizEditorWorkspaceState, 'submitToPremium' | 'visibility'>,
): QuizVisibilityViewModel {
  return state.submitToPremium ? 'personal' : state.visibility;
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
    case 'setSubmitToPremium':
      return { ...state, submitToPremium: action.value };
    case 'setVisibility':
      return { ...state, visibility: action.value };
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
    case 'addOption':
      return { ...state, questions: addOption(state.questions, action.questionIndex) };
    case 'removeOption':
      return {
        ...state,
        questions: removeOption(state.questions, action.questionIndex, action.optionIndex),
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
        questions: addQuestion(state.questions, createEmptyEditorQuestion(action.editorId)),
      };
    case 'insertQuestion':
      return {
        ...state,
        questions: insertQuestion(
          state.questions,
          action.index,
          createEmptyEditorQuestion(action.editorId),
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
