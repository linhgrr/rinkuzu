/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUsersPage from './page';

const { grantCreditsMock, mutateUsersMock, swrMock } = vi.hoisted(() => ({
  grantCreditsMock: vi.fn(),
  mutateUsersMock: vi.fn(),
  swrMock: vi.fn(),
}));

vi.mock('swr', () => ({ default: (...args: unknown[]) => swrMock(...args) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'admin@example.com', role: 'admin' } } }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/features/admin/users/api/admin-users-api', () => ({
  fetchAdminUserListViewModel: vi.fn(),
  grantAdminUserCredits: (...args: unknown[]) => grantCreditsMock(...args),
  grantAdminUserSubscription: vi.fn(),
  updateAdminUserRole: vi.fn(),
  updateAdminUserStatus: vi.fn(),
}));
vi.mock('@/features/admin/plans/api/admin-plans-api', () => ({
  fetchAdminBillingPlanViewModels: vi.fn(),
}));

const user = {
  id: '507f191e810c19729de860ea',
  email: 'learner@example.com',
  role: 'user' as const,
  disable: 0 as const,
  accountStatusLabel: 'accountActive' as const,
  accountStatusVariant: 'success' as const,
  createdAt: '2026-08-24T00:00:00.000Z',
  createdAtLabel: '24/08/2026',
};

describe('AdminUsersPage credit action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    mutateUsersMock.mockResolvedValue(undefined);
    grantCreditsMock.mockResolvedValue({
      userId: user.id,
      amount: 5,
      balance: 12,
      ledgerEntryId: '507f191e810c19729de860eb',
      alreadyApplied: false,
    });
    swrMock.mockImplementation((key: string) =>
      key.startsWith('/api/admin/users')
        ? {
            data: {
              users: [user],
              pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            },
            isLoading: false,
            mutate: mutateUsersMock,
          }
        : { data: [], isLoading: false, mutate: vi.fn() },
    );
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '0aa7c561-a366-4abf-81ec-fb90e64c237c',
    );
  });

  it('opens the modal and submits amount, reason, and a stable idempotency key', async () => {
    render(<AdminUsersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'addCredit' }));
    fireEvent.change(screen.getByLabelText('creditAmount'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('creditReason'), {
      target: { value: 'Verified contribution' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'addCreditButton' }));

    await waitFor(() =>
      expect(grantCreditsMock).toHaveBeenCalledWith({
        userId: user.id,
        amount: 5,
        note: 'Verified contribution',
        idempotencyKey: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
      }),
    );
    expect(await screen.findByText('creditAddedSuccess')).toBeInTheDocument();
  });
});
