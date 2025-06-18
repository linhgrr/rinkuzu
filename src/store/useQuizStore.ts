import { create } from 'zustand';
import { IQuiz, IQuestion, IAttempt } from '@/types';

interface QuizState {
  currentQuiz: IQuiz | null;
  currentQuestionIndex: number;
  userAnswers: number[];
  quizzes: IQuiz[];
  userAttempts: IAttempt[];
  loading: boolean;
  error: string | null;
}

interface QuizActions {
  setCurrentQuiz: (quiz: IQuiz | null) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setUserAnswer: (questionIndex: number, answerIndex: number) => void;
  resetQuizState: () => void;
  setQuizzes: (quizzes: IQuiz[]) => void;
  addQuiz: (quiz: IQuiz) => void;
  updateQuiz: (quizId: string, updates: Partial<IQuiz>) => void;
  removeQuiz: (quizId: string) => void;
  setUserAttempts: (attempts: IAttempt[]) => void;
  addAttempt: (attempt: IAttempt) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  canGoNext: () => boolean;
  canGoPrevious: () => boolean;
  getProgress: () => number;
  isQuizCompleted: () => boolean;
}

const initialState: QuizState = {
  currentQuiz: null,
  currentQuestionIndex: 0,
  userAnswers: [],
  quizzes: [],
  userAttempts: [],
  loading: false,
  error: null,
};

export const useQuizStore = create<QuizState & QuizActions>((set, get) => ({
  ...initialState,

  setCurrentQuiz: (quiz) => set((state) => ({
    currentQuiz: quiz,
    currentQuestionIndex: 0,
    userAnswers: quiz ? new Array(quiz.questions.length).fill(-1) : [],
    error: null,
  })),

  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),

  setUserAnswer: (questionIndex, answerIndex) => set((state) => {
    const newAnswers = [...state.userAnswers];
    newAnswers[questionIndex] = answerIndex;
    return { userAnswers: newAnswers };
  }),

  resetQuizState: () => set({
    currentQuiz: null,
    currentQuestionIndex: 0,
    userAnswers: [],
    error: null,
  }),

  setQuizzes: (quizzes) => set({ quizzes }),

  addQuiz: (quiz) => set((state) => ({
    quizzes: [quiz, ...state.quizzes],
  })),

  updateQuiz: (quizId, updates) => set((state) => ({
    quizzes: state.quizzes.map(quiz =>
      quiz._id === quizId ? { ...quiz, ...updates } : quiz
    ),
  })),

  removeQuiz: (quizId) => set((state) => ({
    quizzes: state.quizzes.filter(quiz => quiz._id !== quizId),
  })),

  setUserAttempts: (attempts) => set({ userAttempts: attempts }),

  addAttempt: (attempt) => set((state) => ({
    userAttempts: [attempt, ...state.userAttempts],
  })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  nextQuestion: () => set((state) => {
    const { currentQuiz, currentQuestionIndex } = state;
    if (currentQuiz && currentQuestionIndex < currentQuiz.questions.length - 1) {
      return { currentQuestionIndex: currentQuestionIndex + 1 };
    }
    return state;
  }),

  previousQuestion: () => set((state) => {
    const { currentQuestionIndex } = state;
    if (currentQuestionIndex > 0) {
      return { currentQuestionIndex: currentQuestionIndex - 1 };
    }
    return state;
  }),

  canGoNext: () => {
    const { currentQuiz, currentQuestionIndex } = get();
    return currentQuiz ? currentQuestionIndex < currentQuiz.questions.length - 1 : false;
  },

  canGoPrevious: () => {
    const { currentQuestionIndex } = get();
    return currentQuestionIndex > 0;
  },

  getProgress: () => {
    const { currentQuiz, userAnswers } = get();
    if (!currentQuiz) return 0;
    const answeredQuestions = userAnswers.filter(answer => answer !== -1).length;
    return Math.round((answeredQuestions / currentQuiz.questions.length) * 100);
  },

  isQuizCompleted: () => {
    const { currentQuiz, userAnswers } = get();
    if (!currentQuiz) return false;
    return userAnswers.every(answer => answer !== -1);
  },
})); 