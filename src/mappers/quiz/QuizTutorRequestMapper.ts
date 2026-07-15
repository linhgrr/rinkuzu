import type { QuizTutorStreamRequestDto } from '@/dtos/quiz-tutor';
import type { components } from '@/generated/adaptive-api';

type QuizTutorRequest = components['schemas']['QuizTutorRequest'];

export class QuizTutorRequestMapper {
  static toApiRequest(input: QuizTutorStreamRequestDto): QuizTutorRequest {
    return {
      question: input.question,
      options: input.options,
      userQuestion: input.userQuestion ?? null,
      questionImage: input.questionImage ?? null,
      ...(input.optionImages !== undefined && {
        optionImages: input.optionImages.map((image) => image ?? null),
      }),
      ...(input.chatHistory !== undefined && {
        chatHistory: input.chatHistory.map(({ role, content }) => ({ role, content })),
      }),
      stream: true,
    };
  }
}
