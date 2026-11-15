/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PremiumQuizSignInPrompt } from './PremiumQuizSignInPrompt';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe('PremiumQuizSignInPrompt', () => {
  it('shows the quiz and a sign-in that returns to it, plus sign-up', () => {
    render(
      <PremiumQuizSignInPrompt
        slug="nhap-mon-ai"
        title="Nhập môn trí tuệ nhân tạo"
        questionCount={40}
        description="Trắc nghiệm LMS"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Nhập môn trí tuệ nhân tạo' })).toBeInTheDocument();
    expect(screen.getByText('premiumQuestionCount:{"count":40}')).toBeInTheDocument();
    expect(screen.getByText('Trắc nghiệm LMS')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'premiumSignInButton' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fquiz%2Fnhap-mon-ai',
    );
    expect(screen.getByRole('link', { name: 'premiumSignUpButton' })).toHaveAttribute(
      'href',
      '/register?callbackUrl=%2Fquiz%2Fnhap-mon-ai',
    );
  });

  it('keeps a tracked entry on the way back to the quiz (RIN-1000)', () => {
    render(
      <PremiumQuizSignInPrompt slug="q" title="Quiz" questionCount={1} entry="activation_email" />,
    );

    expect(screen.getByRole('link', { name: 'premiumSignInButton' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fquiz%2Fq%3Fentry%3Dactivation_email',
    );
  });

  it('drops an entry it does not track', () => {
    render(<PremiumQuizSignInPrompt slug="q" title="Quiz" questionCount={1} entry="other" />);

    expect(screen.getByRole('link', { name: 'premiumSignInButton' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fquiz%2Fq',
    );
  });

  it('omits the description paragraph when the quiz has none', () => {
    render(<PremiumQuizSignInPrompt slug="q" title="Quiz" questionCount={1} />);
    expect(screen.queryByText('Trắc nghiệm LMS')).not.toBeInTheDocument();
  });

  it('offers the free preview, sized by the shared limit and never above the quiz length (RIN-1722)', () => {
    const { rerender } = render(
      <PremiumQuizSignInPrompt slug="nhap-mon-ai" title="Quiz" questionCount={40} />,
    );
    expect(screen.getByText('premiumSignInTitle:{"count":5}')).toBeInTheDocument();
    expect(screen.getByText('premiumSignInHint')).toBeInTheDocument();

    rerender(<PremiumQuizSignInPrompt slug="nhap-mon-ai" title="Quiz" questionCount={3} />);
    expect(screen.getByText('premiumSignInTitle:{"count":3}')).toBeInTheDocument();
  });
});
