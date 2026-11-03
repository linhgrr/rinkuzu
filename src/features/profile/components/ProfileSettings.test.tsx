/** @vitest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileSettings from './ProfileSettings';

const { fetchProfileMock, routerReplaceMock, sessionState, translateMock } = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  routerReplaceMock: vi.fn(),
  sessionState: { current: { user: { id: 'user-1' } } },
  translateMock: (key: string) => key,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionState.current, status: 'authenticated' }),
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
  useRouter: () => ({ replace: routerReplaceMock }),
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

const learnerProfile = {
  email: 'learner@example.com',
  displayName: 'Learner',
  bio: 'Learning one concept at a time.',
  role: 'user',
  createdAt: '2026-07-01T00:00:00.000Z',
  createdAtLabel: '01/07/2026',
};

describe('ProfileSettings control center', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionState.current = { user: { id: 'user-1' } };
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

  it('keeps the loaded page and typed input when the session poll returns a new object for the same user', async () => {
    const user = userEvent.setup();
    fetchProfileMock.mockResolvedValue(learnerProfile);

    const { rerender } = render(<ProfileSettings initialTab="personal" />);

    const displayName = await screen.findByLabelText('displayName');
    await user.clear(displayName);
    await user.type(displayName, 'Typed name');

    // next-auth hands useSession() a fresh object on every refetchInterval tick.
    for (let tick = 0; tick < 3; tick += 1) {
      sessionState.current = { user: { id: 'user-1' } };
      rerender(<ProfileSettings initialTab="personal" />);
      expect(screen.queryByLabelText('loading')).toBeNull();
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect(fetchProfileMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('loading')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('displayName').value).toBe('Typed name');
  });

  it('switches tabs without refetching and follows a new initialTab from the URL', async () => {
    const user = userEvent.setup();
    fetchProfileMock.mockResolvedValue(learnerProfile);

    const { rerender } = render(<ProfileSettings initialTab="security" />);

    expect(await screen.findByLabelText('currentPassword')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'personalTab' }));
    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      { pathname: '/profile', query: { tab: 'personal' } },
      { scroll: false },
    );
    // The page re-renders with the new ?tab= after router.replace.
    rerender(<ProfileSettings initialTab="personal" />);
    expect(screen.getByLabelText('displayName')).toBeTruthy();

    // Browser back/forward changes ?tab= without a click.
    rerender(<ProfileSettings initialTab="plan" />);
    expect(screen.getByRole('tab', { name: 'planQuotaTab' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByTestId('quota-full')).toBeTruthy();

    expect(fetchProfileMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('loading')).toBeNull();
  });
});
