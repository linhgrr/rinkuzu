import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { HomeDashboard } from '@/features/dashboard/components/HomeDashboard';
import type {
  DashboardHomeCopy,
  DashboardLearningCardViewModel,
  DashboardStarterViewModel,
} from '@/features/dashboard/types/dashboard-view-model';

// RIN-556 (spec RIN-550): a new learner is pointed at a short starter quiz.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));

vi.mock('@/features/dashboard/components/QuizUploadDropzone', () => ({
  QuizUploadDropzone: () => null,
}));

vi.mock('@/features/communications/components/MarketingPreferencePrompt', () => ({
  MarketingPreferencePrompt: ({ placement }: { placement?: string }) => (
    <aside data-testid={`marketing-prompt-${placement ?? 'docked'}`} />
  ),
}));

const section = { title: 'Section', subtitle: 'Subtitle', emptyAction: 'Empty' };
const copy: DashboardHomeCopy = {
  welcomeTitle: 'Welcome back',
  welcomeSubtitle: 'Keep going',
  viewAll: 'View all',
  hero: {
    title: 'Hero',
    description: 'Hero description',
    cta: 'Start learning',
    adaptiveLink: 'Or upload a PDF',
  },
  starter: {
    title: 'New here? Try a 2-minute quiz',
    subtitle: 'No upload needed',
    start: 'Start quiz',
    alternativesLabel: 'Or try',
    questionCount: (count) => `${count} questions`,
  },
  quizBuilder: { title: 'Quiz builder', subtitle: 'From PDF' },
  continueLearning: { title: 'Continue', subtitle: 'Resume' },
  recentOwnedQuizzes: section,
  recentPublicQuizzes: section,
  learningProgress: {
    title: 'Progress',
    subtitle: 'This week',
    dayStreak: 'Day streak',
    accuracy: 'Accuracy',
    studyTime: 'Study time',
  },
};

const starter: DashboardStarterViewModel = {
  primary: {
    slug: 'fake-starter',
    title: 'Fake starter',
    questionCount: 10,
    href: '/quiz/fake-starter',
  },
  alternatives: [
    { slug: 'fake-alt', title: 'Fake alternative', questionCount: 6, href: '/quiz/fake-alt' },
  ],
};

function renderDashboard(input: {
  starter: DashboardStarterViewModel | null;
  heroCtaHref: string;
  continueLearning?: { items: DashboardLearningCardViewModel[]; viewAllHref: string };
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <HomeDashboard
        copy={copy}
        viewModel={{
          userName: 'Learner',
          progress: { streak: 0, accuracyPercent: 0, studyHours: 0, dueCount: 0, weekDays: [] },
          continueLearning: { items: [], viewAllHref: '/my-quizzes' },
          recentOwnedQuizzes: [],
          recentPublicQuizzes: [],
          ...input,
        }}
      />
    </NextIntlClientProvider>,
  );
}

describe('HomeDashboard starter quiz', () => {
  it('shows the starter block and points the hero at the starter quiz for a new learner', () => {
    renderDashboard({ starter, heroCtaHref: '/quiz/fake-starter' });

    const block = screen.getByTestId('starter-quiz-block');
    expect(within(block).getByText('New here? Try a 2-minute quiz')).toBeInTheDocument();
    expect(screen.getByTestId('starter-quiz-primary')).toHaveAttribute(
      'href',
      '/en/quiz/fake-starter',
    );
    expect(within(block).getByText('10 questions')).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: /Fake alternative/ })).toHaveAttribute(
      'href',
      '/en/quiz/fake-alt',
    );

    // RIN-988: the starter card is the single primary CTA. The hero keeps
    // only the PDF upload as a secondary action, with no duplicate quiz button.
    expect(screen.queryByTestId('home-hero-cta')).not.toBeInTheDocument();
    const upload = screen.getByTestId('home-hero-upload');
    expect(upload).toHaveAttribute('href', '/en/adaptive');
    expect(upload).toHaveTextContent('Or upload a PDF');
    expect(upload.className).toContain('btn-secondary');
  });

  it('hides Continue Learning while there is nothing to continue', () => {
    renderDashboard({ starter, heroCtaHref: '/quiz/fake-starter' });

    expect(screen.queryByText('Continue')).not.toBeInTheDocument();
  });

  it('keeps empty quiz sections to secondary actions', () => {
    renderDashboard({ starter, heroCtaHref: '/quiz/fake-starter' });

    for (const link of screen.getAllByRole('link', { name: 'Empty' })) {
      expect(link.className).toContain('btn-secondary');
      expect(link.className).not.toContain('bg-primary');
    }
  });

  it('renders the email choices in the page flow, after the dashboard cards', () => {
    renderDashboard({ starter, heroCtaHref: '/quiz/fake-starter' });

    expect(screen.getByTestId('marketing-prompt-inline')).toBeInTheDocument();
  });

  it('renders today’s dashboard once the learner has graduated', () => {
    renderDashboard({ starter: null, heroCtaHref: '/adaptive' });

    expect(screen.queryByTestId('starter-quiz-block')).not.toBeInTheDocument();
    const heroCta = screen.getByTestId('home-hero-cta');
    expect(heroCta).toHaveAttribute('href', '/en/adaptive');
    expect(heroCta).toHaveTextContent('Start learning');
    expect(screen.queryByTestId('home-hero-upload')).not.toBeInTheDocument();
  });

  it('shows Continue Learning once there is something to continue', () => {
    renderDashboard({
      starter: null,
      heroCtaHref: '/adaptive',
      continueLearning: {
        items: [
          {
            id: 'fake-item',
            title: 'Fake in-progress quiz',
            category: 'In progress',
            progress: 40,
            timeLabel: 'Today',
            href: '/quiz/fake-in-progress',
            tone: 'warm',
            isAi: false,
          },
        ],
        viewAllHref: '/my-quizzes',
      },
    });

    expect(screen.getByText('Continue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fake in-progress quiz/ })).toBeInTheDocument();
  });
});
