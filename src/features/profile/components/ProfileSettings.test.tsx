/** @vitest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileSettings from './ProfileSettings';

const { fetchProfileMock, sessionData, translateMock } = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  sessionData: { user: { id: 'user-1' } },
  translateMock: (key: string) => key,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionData }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => translateMock,
}));

vi.mock('next/image', () => ({
  default: ({ alt }: ComponentProps<'img'>) => <span role="img" aria-label={alt ?? ''} />,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: () => null,
}));

vi.mock('@/features/profile/api/profile-settings-api', () => ({
  changeProfilePassword: vi.fn(),
  fetchProfileSettingsViewModel: fetchProfileMock,
  removeProfileAvatar: vi.fn(),
  updateProfileSettingsViewModel: vi.fn(),
  uploadProfileAvatar: vi.fn(),
}));

vi.mock('@/features/profile/components/ProfileQuotaCard', () => ({
  ProfileQuotaCard: ({ variant = 'full' }: { variant?: 'summary' | 'full' }) => (
    <div data-testid={`quota-${variant}`} />
  ),
}));

vi.mock('@/features/communications/components/MarketingPreferencesPage', () => ({
  MarketingPreferencesPage: () => <div data-testid="email-preferences" />,
}));

describe('ProfileSettings control center', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens on overview and exposes each focused profile panel', async () => {
    const user = userEvent.setup();
    fetchProfileMock.mockResolvedValue({
      email: 'learner@example.com',
      displayName: 'Learner',
      bio: 'Learning one concept at a time.',
      role: 'user',
      createdAt: '2026-07-01T00:00:00.000Z',
      createdAtLabel: '01/07/2026',
    });

    render(<ProfileSettings />);

    expect(await screen.findByRole('heading', { name: 'Learner' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'overviewTab' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByTestId('quota-summary')).toBeTruthy();
    expect(screen.queryByLabelText('displayName')).toBeNull();
    expect(screen.queryByLabelText('currentPassword')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'personalTab' }));
    expect(screen.getByLabelText('displayName')).toBeTruthy();
    expect(screen.queryByTestId('quota-summary')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'planQuotaTab' }));
    expect(screen.getByTestId('quota-full')).toBeTruthy();
    expect(screen.getByText('accountSection')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'securityTab' }));
    expect(screen.getByLabelText('currentPassword')).toBeTruthy();
    expect(screen.queryByTestId('quota-full')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'emailPreferencesTab' }));
    expect(screen.getByTestId('email-preferences')).toBeTruthy();
    expect(screen.queryByLabelText('currentPassword')).toBeNull();
  });

  it('moves from the overview hero to personal editing', async () => {
    const user = userEvent.setup();
    fetchProfileMock.mockResolvedValue({
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'user',
      createdAt: '2026-07-01T00:00:00.000Z',
      createdAtLabel: '01/07/2026',
    });

    render(<ProfileSettings />);

    await user.click(await screen.findByRole('button', { name: 'editProfile' }));
    expect(screen.getByRole('tab', { name: 'personalTab' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByLabelText('displayName')).toBeTruthy();
  });
});
