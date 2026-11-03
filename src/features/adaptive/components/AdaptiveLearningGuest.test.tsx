// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdaptiveLearningGuest from './AdaptiveLearningGuest';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock('@/components/seo/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/components/ui/QuestionContent', () => ({
  QuestionContent: ({ content }: { content: string }) => <span>{content}</span>,
}));

describe('AdaptiveLearningGuest', () => {
  it('sends guests who sign up or sign in back to personalized learning', () => {
    render(<AdaptiveLearningGuest locale="vi" t={(key: string) => key} />);

    expect(screen.getByRole('link', { name: 'guest.loginCta' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fadaptive',
    );
    expect(screen.getByRole('link', { name: 'guest.registerCta' })).toHaveAttribute(
      'href',
      '/register?callbackUrl=%2Fadaptive',
    );
  });
});
