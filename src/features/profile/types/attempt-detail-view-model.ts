export interface AttemptQuestionDetailViewModel {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
  userAnswer: number | number[];
  isCorrect: boolean;
}

export interface AttemptDetailViewModel {
  id: string;
  score: number;
  takenAt: string;
  takenAtLabel: string;
  answers: (number | number[])[];
  quiz: {
    title: string;
    slug: string;
    description?: string;
    questions: AttemptQuestionDetailViewModel[];
  };
}
