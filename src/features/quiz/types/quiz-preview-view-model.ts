interface QuizPreviewQuestionBaseViewModel {
  id?: string;
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export type QuizPreviewQuestionViewModel =
  | (QuizPreviewQuestionBaseViewModel & {
      type: 'single';
      correctIndex: number;
    })
  | (QuizPreviewQuestionBaseViewModel & {
      type: 'multiple';
      correctIndexes: number[];
    });
