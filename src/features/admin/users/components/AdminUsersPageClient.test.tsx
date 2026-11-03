import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserViewModel } from '@/features/admin/users/types/admin-users-view-model';

const { mutateUsersMock, swrMock, updateTestAccountMock, translate } = vi.hoisted(() => ({
  mutateUsersMock: vi.fn(),
  swrMock: vi.fn(),
  updateTestAccountMock: vi.fn(),
  translate: (key: string) => key,
}));

vi.mock('swr', () => ({ default: (...args: unknown[]) => swrMock(...args) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'admin@example.com', role: 'admin' } } }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => translate,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/admin/users/api/admin-users-api', () => ({
  fetchAdminUserListViewModel: vi.fn(),
  grantAdminUserCredits: vi.fn(),
  grantAdminUserSubscription: vi.fn(),
  updateAdminUserRole: vi.fn(),
  updateAdminUserStatus: vi.fn(),
  updateAdminUserTestAccount: (...args: unknown[]) => updateTestAccountMock(...args),
}));
vi.mock('@/features/admin/plans/api/admin-plans-api', () => ({
  fetchAdminBillingPlanViewModels: vi.fn(),
}));

import { AdminUsersPageClient } from './AdminUsersPageClient';

const LEARNER_ID = '507f191e810c19729de860ea';
const FLAGGED_ID = '507f191e810c19729de860eb';

function userRow(overrides: Partial<AdminUserViewModel>): AdminUserViewModel {
  return {
    id: LEARNER_ID,
    email: 'learner@example.com',
    role: 'user',
    disable: 0,
    accountStatusLabel: 'accountActive',
    accountStatusVariant: 'success',
    isTestAccount: false,
    createdAt: '2026-08-24T00:00:00.000Z',
    createdAtLabel: '24/08/2026',
    ...overrides,
  };
}

const learner = userRow({});
const flagged = userRow({ id: FLAGGED_ID, email: 'qa-bot@example.com', isTestAccount: true });

function rowOf(email: string): HTMLElement {
  const row = screen.getByText(email).closest('tr');
  if (!row) throw new Error(`No table row for ${email}`);
  return row;
}

describe('AdminUsersPageClient test-account flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no modal dialog; the confirm step renders through one.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    mutateUsersMock.mockResolvedValue(undefined);
    swrMock.mockImplementation((key: string) =>
      key.startsWith('/api/admin/users')
        ? {
            data: {
              users: [learner, flagged],
              pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
            },
            isLoading: false,
            mutate: mutateUsersMock,
          }
        : { data: [], isLoading: false, mutate: vi.fn() },
    );
  });

  it('badges only the flagged row and offers the matching toggle on each row', () => {
    render(<AdminUsersPageClient />);

    expect(within(rowOf(flagged.email)).getByText('testAccountBadge')).toBeInTheDocument();
    expect(within(rowOf(learner.email)).queryByText('testAccountBadge')).not.toBeInTheDocument();
    expect(
      within(rowOf(learner.email)).getByRole('button', { name: 'markTestAccount' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf(flagged.email)).getByRole('button', { name: 'unmarkTestAccount' }),
    ).toBeInTheDocument();
  });

  it('marks an account only after confirmation, then refreshes the list', async () => {
    const user = userEvent.setup();
    updateTestAccountMock.mockResolvedValue({ id: LEARNER_ID, isTestAccount: true, changed: true });

    render(<AdminUsersPageClient />);

    await user.click(within(rowOf(learner.email)).getByRole('button', { name: 'markTestAccount' }));
    expect(updateTestAccountMock).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('markTestAccountConfirm')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'markTestAccount' }));

    await waitFor(() =>
      expect(updateTestAccountMock).toHaveBeenCalledWith({
        userId: LEARNER_ID,
        isTestAccount: true,
      }),
    );
    expect(await screen.findByText('testAccountMarkedSuccess')).toBeInTheDocument();
    expect(mutateUsersMock).toHaveBeenCalledTimes(1);
  });

  it('clears the flag on a flagged account and reports an unchanged value honestly', async () => {
    const user = userEvent.setup();
    updateTestAccountMock.mockResolvedValue({
      id: FLAGGED_ID,
      isTestAccount: false,
      changed: false,
    });

    render(<AdminUsersPageClient />);

    await user.click(
      within(rowOf(flagged.email)).getByRole('button', { name: 'unmarkTestAccount' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('unmarkTestAccountConfirm')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'unmarkTestAccount' }));

    await waitFor(() =>
      expect(updateTestAccountMock).toHaveBeenCalledWith({
        userId: FLAGGED_ID,
        isTestAccount: false,
      }),
    );
    expect(await screen.findByText('testAccountUnchanged')).toBeInTheDocument();
  });

  it('sends nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup();

    render(<AdminUsersPageClient />);

    await user.click(within(rowOf(learner.email)).getByRole('button', { name: 'markTestAccount' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'cancel' }));

    expect(updateTestAccountMock).not.toHaveBeenCalled();
  });

  it('shows the server error and keeps the row when the change is refused', async () => {
    const user = userEvent.setup();
    updateTestAccountMock.mockRejectedValue(new Error('User not found'));

    render(<AdminUsersPageClient />);

    await user.click(within(rowOf(learner.email)).getByRole('button', { name: 'markTestAccount' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'markTestAccount' }));

    expect(await screen.findByText('User not found')).toBeInTheDocument();
    expect(mutateUsersMock).not.toHaveBeenCalled();
    expect(within(rowOf(learner.email)).queryByText('testAccountBadge')).not.toBeInTheDocument();
  });
});
