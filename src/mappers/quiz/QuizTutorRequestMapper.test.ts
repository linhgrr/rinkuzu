import { describe, expect, it } from 'vitest';
import { QuizTutorRequestMapper } from './QuizTutorRequestMapper';

describe('QuizTutorRequestMapper', () => {
  it('maps optional UI values to the generated backend contract', () => {
    expect(
      QuizTutorRequestMapper.toApiRequest({
        question: 'What is 2 + 2?',
        options: ['3', '4'],
        optionImages: [undefined, 'https://example.com/four.png'],
        chatHistory: [{ role: 'user', content: 'Give me a hint' }],
      }),
    ).toEqual({
      question: 'What is 2 + 2?',
      options: ['3', '4'],
      userQuestion: null,
      questionImage: null,
      optionImages: [null, 'https://example.com/four.png'],
      chatHistory: [{ role: 'user', content: 'Give me a hint' }],
      stream: true,
    });
  });
});
