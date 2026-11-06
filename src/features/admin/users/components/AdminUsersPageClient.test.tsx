import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
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
  // The table (md and up) and the card list (below md) both render; jsdom has no CSS.
  const row = screen
    .getAllByText(email)
    .map((node) => node.closest('tr'))
    .find((node): node is HTMLTableRowElement => node !== null);
  if (!row) throw new Error(`No table row for ${email}`);
  return row;
}

async function openActions(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.click(within(rowOf(email)).getByRole('button', { name: 'actions' }));
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

  it('badges only the flagged row and offers the matching toggle on each row', async () => {
    const user = userEvent.setup();
    render(<AdminUsersPageClient />);

    expect(within(rowOf(flagged.email)).getByText('testAccountBadge')).toBeInTheDocument();
    expect(within(rowOf(learner.email)).queryByText('testAccountBadge')).not.toBeInTheDocument();
    await openActions(user, learner.email);
    expect(
      within(rowOf(learner.email)).getByRole('button', { name: 'markTestAccount' }),
    ).toBeInTheDocument();
    await openActions(user, flagged.email);
    expect(
      within(rowOf(flagged.email)).getByRole('button', { name: 'unmarkTestAccount' }),
    ).toBeInTheDocument();
  });

  it('marks an account only after confirmation, then refreshes the list', async () => {
    const user = userEvent.setup();
    updateTestAccountMock.mockResolvedValue({ id: LEARNER_ID, isTestAccount: true, changed: true });

    render(<AdminUsersPageClient />);

    await openActions(user, learner.email);

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

    await openActions(user, flagged.email);

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

    await openActions(user, learner.email);

    await user.click(within(rowOf(learner.email)).getByRole('button', { name: 'markTestAccount' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'cancel' }));

    expect(updateTestAccountMock).not.toHaveBeenCalled();
  });

  it('shows localized copy, not server text, and keeps the row when refused', async () => {
    const user = userEvent.setup();
    updateTestAccountMock.mockRejectedValue(
      new ApiResponseError({
        message: 'User not found',
        status: 404,
        payload: null,
        code: 'not_found',
      }),
    );

    render(<AdminUsersPageClient />);

    await openActions(user, learner.email);

    await user.click(within(rowOf(learner.email)).getByRole('button', { name: 'markTestAccount' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'markTestAccount' }));

    expect(
      await screen.findByText('errors.api.notFound · errors.api.codeLabel'),
    ).toBeInTheDocument();
    expect(screen.queryByText('User not found')).not.toBeInTheDocument();
    expect(mutateUsersMock).not.toHaveBeenCalled();
    expect(within(rowOf(learner.email)).queryByText('testAccountBadge')).not.toBeInTheDocument();
  });
});

describe('AdminUsersPageClient row layout (RIN-1021)', () => {
  const LONG_EMAIL = `${'a-very-long-learner-name'.repeat(3)}@long-subdomain.example.com`;
  const longEmailUser = userRow({ id: '507f191e810c19729de860ec', email: LONG_EMAIL });
  const selfUser = userRow({
    id: '507f191e810c19729de860ed',
    email: 'admin@example.com',
    role: 'admin',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    swrMock.mockImplementation((key: string) =>
      key.startsWith('/api/admin/users')
        ? {
            data: {
              users: [longEmailUser, selfUser, learner],
              pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
            },
            isLoading: false,
            mutate: mutateUsersMock,
          }
        : { data: [], isLoading: false, mutate: vi.fn() },
    );
  });

  it('truncates a long email in a fixed-layout table and keeps the full address in title', () => {
    render(<AdminUsersPageClient />);

    expect(LONG_EMAIL.length).toBeGreaterThanOrEqual(90);
    const emails = screen.getAllByText(LONG_EMAIL);
    // One in the table row, one in the card list shown below md.
    expect(emails).toHaveLength(2);
    for (const email of emails) {
      expect(email).toHaveAttribute('title', LONG_EMAIL);
      expect(email).toHaveClass('truncate', 'min-w-0');
    }
    expect(screen.getByRole('table')).toHaveClass('table-fixed', 'w-full');

    const row = rowOf(LONG_EMAIL);
    expect(within(row).getAllByRole('cell')).toHaveLength(4);
    // Subscription and created sit under the email instead of in their own columns.
    expect(within(row).getByText('noSubscription')).toBeInTheDocument();
    expect(within(row).getByText('24/08/2026')).toBeInTheDocument();
    const trigger = within(row).getByRole('button', { name: 'actions' });
    expect(trigger).toHaveAttribute('aria-describedby', emails[0]?.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('lists every action in row order and closes the menu on Escape', async () => {
    const user = userEvent.setup();
    render(<AdminUsersPageClient />);

    const row = rowOf(LONG_EMAIL);
    const trigger = within(row).getByRole('button', { name: 'actions' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
    if (!panel) throw new Error('Actions panel not rendered');
    const items = Array.from(panel.querySelectorAll('a, button'), (item) => item.textContent);
    expect(items).toEqual([
      'Hỗ trợ',
      'Mời phản hồi',
      'addCredit',
      'markTestAccount',
      'addSubscription',
      'makeAdmin',
      'disable',
    ]);

    await user.tab();
    expect(within(panel).getByRole('link', { name: 'Hỗ trợ' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(document.getElementById(panel.id)).toBeNull();
  });

  it('offers no role, status or subscription change on your own row', async () => {
    const user = userEvent.setup();
    render(<AdminUsersPageClient />);

    const row = rowOf(selfUser.email);
    expect(within(row).getByText('you')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'actions' }));
    expect(within(row).getByRole('button', { name: 'addCredit' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'makeUser' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'disable' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'addSubscription' })).not.toBeInTheDocument();
  });
});
