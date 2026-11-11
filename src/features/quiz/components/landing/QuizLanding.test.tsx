import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import viProfile from '../../../../../messages/vi/profile.json';
import viQuiz from '../../../../../messages/vi/quiz.json';
import type { QuizLandingViewModel } from '@/features/quiz/types/quiz-landing-view-model';

vi.mock('next-intl/server', () => ({
  getTranslations: ({ namespace }: { namespace: string }) =>
    Promise.resolve(
      createTranslator({
        locale: 'vi',
        messages: { quiz: viQuiz },
        namespace: namespace as 'quiz',
      }),
    ),
}));

vi.mock('@/features/quiz/components/ReportQuizPageLink', () => ({
  ReportQuizPageLink: (props: {
    slug: string;
    viewerEmail: string | null;
    ownedByViewer: boolean;
  }) => <span data-report-link={JSON.stringify(props)} />,
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
      id: `q${index}`,
      text: `Câu hỏi số ${index + 1}`,
      options: [
        { letter: 'A', text: 'Ti thể' },
        { letter: 'B', text: 'Lục lạp' },
      ],
    })),
    related: [
      {
        slug: 'hoa-hoc',
        title: 'Hóa học 10',
        questionCount: 12,
        author: { name: null, displayName: 'Thầy Minh', avatar: null },
      },
    ],
    relatedSameTopic: false,
    topic: null,
    hubEntry: null,
    ...overrides,
  };
}

async function render(landing: QuizLandingViewModel, signedIn = false): Promise<string> {
  // Related quizzes use the shared QuizCard (RIN-1466), which reads the client intl context.
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="vi" messages={{ profile: viProfile }}>
      {await QuizLanding({ locale: 'vi', landing, signedIn })}
    </NextIntlClientProvider>,
  );
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
    // Related quiz titles are h3s under the related h2 (shared QuizCard, RIN-1466).
    expect(html.match(/<h[1-6]\b/gu)).toEqual(['<h1', '<h2', '<h2', '<h3']);
    expect(html).toContain('Xem trước 5 câu đầu');
    expect(html.match(/<ol\b/gu)).toHaveLength(1);
    expect(html).toContain('Câu hỏi số 1');
    expect(html).toContain('Lục lạp');
    expect(html).not.toMatch(/type="radio"|type="checkbox"/u);
  });

  it('spaces preview options apart, with more room between question and options (RIN-1555)', async () => {
    const html = await render(landingWith());

    // Question block: 8 px between number, image and text; options 12 px below the text.
    expect(html).toMatch(/<li class="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">/u);
    expect(html).toMatch(/<ul class="mt-1 space-y-2 text-sm text-ink">/u);
    expect(html).not.toMatch(/space-y-1 text-sm/u);
  });

  it('links related quizzes without an entry, so they open on their landing', async () => {
    const html = await render(landingWith());

    expect(html).toContain('Quiz khác trên RinKuzu');
    expect(html).toContain('href="/vi/quiz/hoa-hoc"');
    // RIN-1469: the shared QuizCard as on Explore: the real author, no play link.
    expect(html).toMatch(
      /<article\b[^>]*>[\s\S]*12 câu hỏi[\s\S]*<h3\b[^>]*>Hóa học 10<\/h3>[\s\S]*Thầy Minh/u,
    );
    expect(html).not.toContain('RinKuzu learner');
    expect(html).not.toContain('entry=hub');
  });

  it('shows "RinKuzu learner" on a related card whose author was deleted', async () => {
    const html = await render(
      landingWith({
        related: [{ slug: 'hoa-hoc', title: 'Hóa học 10', questionCount: 12, author: null }],
      }),
    );

    expect(html).toContain('RinKuzu learner');
  });

  it('keeps the hub entry and topic on both CTAs when opened from a hub card (RIN-1469)', async () => {
    const html = await render(landingWith({ hubEntry: { topic: 'sinh-hoc' } }));

    expect(html).toContain(
      'href="/vi/quiz/sinh-hoc-10?mode=quick&amp;entry=hub&amp;topic=sinh-hoc"',
    );
    expect(html).toContain(
      'href="/vi/quiz/sinh-hoc-10?mode=full&amp;entry=hub&amp;topic=sinh-hoc"',
    );
    expect(html).not.toContain('entry=quiz_landing');
  });

  it('keeps the hub entry without a topic when the link had no valid one', async () => {
    const html = await render(landingWith({ hubEntry: { topic: null } }));

    expect(html).toContain('href="/vi/quiz/sinh-hoc-10?mode=quick&amp;entry=hub"');
    expect(html).not.toContain('topic=');
  });

  it('hides the related block when there is nothing to link', async () => {
    const html = await render(landingWith({ related: [] }));

    expect(html).not.toContain('Quiz khác trên RinKuzu');
  });

  // RIN-1249 (spec C12): same-topic heading and the link back to the hub.
  it('titles same-topic quizzes "Quiz cùng chủ đề" and links back to the hub', async () => {
    const html = await render(
      landingWith({
        relatedSameTopic: true,
        topic: { name: 'Sinh học', href: '/vi/explore/sinh-hoc' },
      }),
    );

    expect(html).toContain('Quiz cùng chủ đề');
    expect(html).not.toContain('Quiz khác trên RinKuzu');
    expect(html).toContain('href="/vi/explore/sinh-hoc"');
    expect(html).toContain('Xem tất cả quiz Sinh học');
  });

  it('keeps the hub link when there are no related quizzes', async () => {
    const html = await render(
      landingWith({ related: [], topic: { name: 'Sinh học', href: '/vi/explore/sinh-hoc' } }),
    );

    expect(html).toContain('href="/vi/explore/sinh-hoc"');
    expect(html).not.toContain('<ul class="grid');
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

  it('ends with the quiz-level report link for the viewer (RIN-1344)', async () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="vi" messages={{ profile: viProfile }}>
        {await QuizLanding({
          locale: 'vi',
          landing: landingWith(),
          signedIn: true,
          viewerEmail: 'learner@example.com',
          ownedByViewer: false,
        })}
      </NextIntlClientProvider>,
    );

    expect(html).toContain('<footer');
    expect(html).toContain(
      'data-report-link="{&quot;slug&quot;:&quot;sinh-hoc-10&quot;,&quot;viewerEmail&quot;:&quot;learner@example.com&quot;,&quot;ownedByViewer&quot;:false}"',
    );
  });
});
