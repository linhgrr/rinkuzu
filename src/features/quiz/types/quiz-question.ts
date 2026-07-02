interface QuizQuestionInputBase {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export type QuizQuestionInputViewModel =
  | (QuizQuestionInputBase & {
      type: 'single';
      correctIndex: number;
    })
  | (QuizQuestionInputBase & {
      type: 'multiple';
      correctIndexes: number[];
    });
