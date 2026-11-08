import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import viQuiz from '../../../../../messages/vi/quiz.json';
import type { QuizLandingViewModel } from '@/features/quiz/types/quiz-landing-view-model';

vi.mock('next-intl/server', () => ({
  getTranslations: ({ namespace }: { namespace: string }) =>
    Promise.resolve(createTranslator({ locale: 'vi', messages: { quiz: viQuiz }, namespace })),
}));

import { QuizLanding } from './QuizLanding';

function landingWith(overrides: Partial<QuizLandingViewModel> = {}): QuizLandingViewModel {
  return {
    slug: 'sinh-hoc-10',
    title: 'Sinh học 10',
    description: 'Đề trắc nghiệm Sinh học 10.',
    authorName: 'Cô Lan',
    questionCount: 20,
    quickRoundEligible: true,
    previewQuestions: Array.from({ length: 5 }, (_, index) => ({
      text: `Câu hỏi số ${index + 1}`,
      options: ['Ti thể', 'Lục lạp'],
    })),
    related: [{ slug: 'hoa-hoc', title: 'Hóa học 10', questionCount: 12 }],
    ...overrides,
  };
}

async function render(landing: QuizLandingViewModel, signedIn = false): Promise<string> {
  return renderToStaticMarkup(await QuizLanding({ locale: 'vi', landing, signedIn }));
}

describe('QuizLanding (RIN-1247)', () => {
  it('starts a quick round and offers the full quiz, both as plain tracked links', async () => {
    const html = await render(landingWith());

    expect(html).toContain('href="/vi/quiz/sinh-hoc-10?mode=quick&amp;entry=quiz_landing"');
    expect(html).toContain('href="/vi/quiz/sinh-hoc-10?mode=full&amp;entry=quiz_landing"');
    expect(html).toContain('Chơi ngay – không cần tài khoản');
    expect(html).toContain('Làm toàn bộ bài (20 câu)');
    expect(html).toContain('10 câu, khoảng 3 phút');
    expect(html).toContain('Còn 15 câu nữa');
    expect(html).toContain('Xem đáp án và làm tiếp – không cần tài khoản');
    expect(html).not.toContain('Chơi nhanh');
  });

  it('renders one h1, then the preview and related h2s, with an ol of questions', async () => {
    const html = await render(landingWith());

    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html.match(/<h[1-6]\b/gu)).toEqual(['<h1', '<h2', '<h2']);
    expect(html).toContain('Xem trước 5 câu đầu');
    expect(html.match(/<ol\b/gu)).toHaveLength(1);
    expect(html).toContain('Câu hỏi số 1');
    expect(html).toContain('Lục lạp');
    expect(html).not.toMatch(/type="radio"|type="checkbox"/u);
  });

  it('links related quizzes without an entry, so they open on their landing', async () => {
    const html = await render(landingWith());

    expect(html).toContain('Quiz khác trên RinKuzu');
    expect(html).toContain('href="/vi/quiz/hoa-hoc"');
  });

  it('hides the related block when there is nothing to link', async () => {
    const html = await render(landingWith({ related: [] }));

    expect(html).not.toContain('Quiz khác trên RinKuzu');
  });

  it('starts the full quiz from a short quiz, with no quick hint or second button', async () => {
    const html = await render(
      landingWith({
        questionCount: 5,
        quickRoundEligible: false,
      }),
    );

    expect(html).not.toContain('mode=quick');
    expect(html).not.toContain('Làm toàn bộ bài');
    expect(html).not.toContain('Còn ');
    expect(html.match(/mode=full&amp;entry=quiz_landing/gu)).toHaveLength(2);
  });

  it('drops "no account needed" for a signed-in viewer', async () => {
    const html = await render(landingWith(), true);

    expect(html).not.toContain('không cần tài khoản');
    expect(html).toContain('Chơi ngay');
    expect(html).toContain('Xem đáp án và làm tiếp');
  });
});
