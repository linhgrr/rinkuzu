/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../messages/en/guestDraft.json';
import viGuest from '../../../../messages/vi/guestDraft.json';

vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'unauthenticated' }) }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { GuestDraftExpiredCard, GuestDraftNotice } from './GuestDraftPlayStates';

describe('guest draft play states for a photo draft (RIN-1793)', () => {
  it('says the quiz is from the photos, in en and vi', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={{ guestDraft: enGuest }}>
        <GuestDraftNotice source="image" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Quiz from your photos/)).toBeInTheDocument();
    unmount();
    render(
      <NextIntlClientProvider locale="vi" messages={{ guestDraft: viGuest }}>
        <GuestDraftNotice source="image" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Quiz từ ảnh của bạn/)).toBeInTheDocument();
  });

  it('the expired card sends the guest back to /try/photo with photo copy', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ guestDraft: enGuest }}>
        <GuestDraftExpiredCard source="image" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Make it again from your photos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Make it again' })).toHaveAttribute(
      'href',
      '/try/photo',
    );
  });
});
