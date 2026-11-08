import { describe, expect, it } from 'vitest';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { toQuizLandingViewModel } from './quiz-landing.mapper';

function quizWith(questionCount: number): QuizPlayViewModel {
  return {
    id: 'quiz-1',
    title: 'Sinh học 10',
    slug: 'sinh-hoc-10',
    author: { id: 'author-1', displayName: 'Cô Lan' },
    folder: null,
    visibility: 'public',
    questionCount,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    questions: Array.from({ length: questionCount }, (_, index) => ({
      id: `q${index}`,
      question: `Câu hỏi số ${index + 1}`,
      options: ['Một', 'Hai', 'Ba'],
      type: 'single' as const,
      // Not in the play DTO today; the mapper must drop it even if it ever is.
      ...{ correctIndex: 1, correctIndexes: [1], explanation: 'Vì thế' },
    })),
  };
}

describe('toQuizLandingViewModel', () => {
  // RIN-1241 C8: the preview carries content only, never an answer or explanation.
  it('previews the first 5 questions with options and no answer fields', () => {
    const landing = toQuizLandingViewModel({
      slug: 'sinh-hoc-10',
      quiz: quizWith(20),
      description: 'Mô tả',
      authorName: 'Cô Lan',
      related: [],
    });

    expect(landing.previewQuestions).toHaveLength(5);
    expect(landing.previewQuestions[0]).toEqual({
      id: 'q0',
      text: 'Câu hỏi số 1',
      options: [
        { letter: 'A', text: 'Một' },
        { letter: 'B', text: 'Hai' },
        { letter: 'C', text: 'Ba' },
      ],
    });
    const serialized = JSON.stringify(landing);
    expect(serialized).not.toMatch(/correctIndex|explanation|Vì thế/u);
    expect(landing.quickRoundEligible).toBe(true);
  });

  it('shows every question of a short quiz and starts the full quiz', () => {
    const landing = toQuizLandingViewModel({
      slug: 'sinh-hoc-10',
      quiz: quizWith(3),
      description: '',
      authorName: null,
      related: [{ slug: 'hoa-hoc', title: 'Hóa học', questionCount: 12 }],
    });

    expect(landing.previewQuestions).toHaveLength(3);
    expect(landing.quickRoundEligible).toBe(false);
    expect(landing.related).toEqual([{ slug: 'hoa-hoc', title: 'Hóa học', questionCount: 12 }]);
  });
});
