/** @vitest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import ProfileSettings from './ProfileSettings';

const {
  changePasswordMock,
  fetchProfileMock,
  routerPushMock,
  routerReplaceMock,
  sessionState,
  toastErrorMock,
  translateMock,
} = vi.hoisted(() => ({
  changePasswordMock: vi.fn(),
  fetchProfileMock: vi.fn(),
  routerPushMock: vi.fn(),
  routerReplaceMock: vi.fn(),
  toastErrorMock: vi.fn(),
  sessionState: { current: { user: { id: 'user-1' } } },
  translateMock: (key: string) => key,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionState.current, status: 'authenticated' }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => translateMock,
  useLocale: () => 'en',
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
  useRouter: () => ({ replace: routerReplaceMock, push: routerPushMock, back: vi.fn() }),
  usePathname: () => '/profile',
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock, success: vi.fn() },
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: () => null,
}));

vi.mock('@/features/profile/api/profile-settings-api', () => ({
  changeProfilePassword: changePasswordMock,
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

const serverFailure = (status: number, code: string, meta?: unknown) =>
  new ApiResponseError({
    message: 'Mongo timeout for learner@example.com',
    status,
    payload: { success: false, error: { code, detail: 'learner@example.com' } },
    code,
    detail: 'Mongo timeout for learner@example.com',
    meta,
  });

describe('ProfileSettings API errors (RIN-755)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    sessionState.current = { user: { id: 'user-1' } };
  });

  it('shows an inline ErrorState with retry when the profile fails to load, never the server text', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    fetchProfileMock
      .mockRejectedValueOnce(serverFailure(500, 'internal_error'))
      .mockResolvedValueOnce(learnerProfile);

    render(<ProfileSettings />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('errors.api.server');
    expect(document.body.textContent).not.toContain('learner@example.com');
    expect(toastErrorMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'common.retry' }));

    expect(await screen.findByRole('heading', { name: 'Learner' })).toBeTruthy();
    expect(fetchProfileMock).toHaveBeenCalledTimes(2);
  });

  it('offers sign-in instead of an error box when the session expired', async () => {
    fetchProfileMock.mockRejectedValueOnce(serverFailure(401, 'unauthorized'));

    render(<ProfileSettings />);

    const signIn = await screen.findByRole('link', { name: 'errors.api.actions.signIn' });
    expect(signIn.getAttribute('href')).toBe(
      `/login?callbackUrl=${encodeURIComponent('/profile')}`,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  async function submitPasswordChange() {
    const user = userEvent.setup();
    fetchProfileMock.mockResolvedValue(learnerProfile);
    render(<ProfileSettings initialTab="security" />);
    await user.type(await screen.findByLabelText('currentPassword'), 'old-secret');
    await user.type(screen.getByLabelText('newPassword'), 'new-secret-1');
    await user.type(screen.getByLabelText('confirmNewPassword'), 'new-secret-1');
    await user.click(screen.getByRole('button', { name: 'updatePassword' }));
  }

  it('toasts localized copy when changing the password fails on the server', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    changePasswordMock.mockRejectedValueOnce(serverFailure(500, 'internal_error'));

    await submitPasswordChange();

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('errors.api.server'));
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain('learner@example.com');
  });

  it('says the current password is wrong for a 400, without the server text', async () => {
    changePasswordMock.mockRejectedValueOnce(serverFailure(400, 'validation_error'));

    await submitPasswordChange();

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('currentPasswordIncorrect'));
  });

  it('says the account has no password, not that it is wrong, for password_not_set', async () => {
    changePasswordMock.mockRejectedValueOnce(serverFailure(400, 'password_not_set'));

    await submitPasswordChange();

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('passwordNotSet'));
    expect(toastErrorMock).not.toHaveBeenCalledWith('currentPasswordIncorrect');
  });

  it('blames the new password, not the current one, when the 400 names newPassword', async () => {
    changePasswordMock.mockRejectedValueOnce(
      serverFailure(400, 'validation_error', {
        fields: { newPassword: 'Password must be at least 8 characters' },
      }),
    );

    await submitPasswordChange();

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('newPasswordRejected'));
    expect(toastErrorMock).not.toHaveBeenCalledWith('currentPasswordIncorrect');
  });

  it('rejects a new password shorter than 8 characters before calling the server', async () => {
    const user = userEvent.setup();
    fetchProfileMock.mockResolvedValue(learnerProfile);
    render(<ProfileSettings initialTab="security" />);
    await user.type(await screen.findByLabelText('currentPassword'), 'old-secret');
    await user.type(screen.getByLabelText('newPassword'), 'seven77');
    await user.type(screen.getByLabelText('confirmNewPassword'), 'seven77');
    await user.click(screen.getByRole('button', { name: 'updatePassword' }));

    expect(toastErrorMock).toHaveBeenCalledWith('passwordMinLength');
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('sends an expired session to sign-in instead of toasting', async () => {
    changePasswordMock.mockRejectedValueOnce(serverFailure(401, 'unauthorized'));

    await submitPasswordChange();

    await waitFor(() => expect(routerPushMock).toHaveBeenCalledTimes(1));
    expect(String(routerPushMock.mock.calls[0]?.[0])).toMatch(/^\/login\?callbackUrl=/);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
