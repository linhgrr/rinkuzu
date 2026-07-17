interface QuizTutorChatMessageDto {
  role: 'user' | 'assistant';
  content: string;
}

export interface QuizTutorStreamRequestDto {
  question: string;
  options: string[];
  userQuestion?: string;
  questionImage?: string;
  optionImages?: Array<string | undefined>;
  chatHistory?: QuizTutorChatMessageDto[];
}
