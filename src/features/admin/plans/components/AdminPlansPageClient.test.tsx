import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import type { AdminBillingPlanViewModel } from '@/features/admin/plans/types/admin-plans-view-model';

const { fetchPlansMock, translate } = vi.hoisted(() => ({
  fetchPlansMock: vi.fn(),
  translate: (key: string) => key,
}));

// Stable `t`: the page lists the error describer as a load-effect dependency.
vi.mock('next-intl', () => ({
  useTranslations: () => translate,
  useLocale: () => 'en',
}));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/admin/plans',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/admin/plans/api/admin-plans-api', () => ({
  fetchAdminBillingPlanViewModels: (...args: unknown[]) => fetchPlansMock(...args),
  createAdminBillingPlan: vi.fn(),
  deleteAdminBillingPlan: vi.fn(),
  updateAdminBillingPlan: vi.fn(),
}));

import { AdminPlansPageClient } from './AdminPlansPageClient';

const serverError = new ApiResponseError({
  message: 'internal detail',
  status: 500,
  payload: null,
  code: 'internal',
});

const fakePlan: AdminBillingPlanViewModel = {
  id: '507f191e810c19729de860ea',
  name: 'Fake Monthly',
  price: 49000,
  priceLabel: '49.000 ₫',
  duration: '1_month',
  durationLabel: '1 month',
  isActive: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  createdAtLabel: '01/07/2026',
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedAtLabel: '01/07/2026',
};

describe('AdminPlansPageClient load states (RIN-1158)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('shows ErrorState with Retry and no empty-state copy when the list fails', async () => {
    fetchPlansMock.mockRejectedValue(serverError);
    render(<AdminPlansPageClient />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('errors.api.server')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
    expect(screen.queryByText('noPlansFound')).not.toBeInTheDocument();
    expect(screen.queryByText(/codeLabel|Code:/)).not.toBeInTheDocument();
    expect(screen.queryByText('internal detail')).not.toBeInTheDocument();
  });

  it('refetches on Retry and recovers the list', async () => {
    const user = userEvent.setup();
    fetchPlansMock.mockRejectedValueOnce(serverError).mockResolvedValue([fakePlan]);
    render(<AdminPlansPageClient />);

    await user.click(await screen.findByRole('button', { name: 'common.retry' }));

    expect(await screen.findByText('Fake Monthly')).toBeInTheDocument();
    expect(fetchPlansMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the empty state only after a successful empty response', async () => {
    fetchPlansMock.mockResolvedValue([]);
    render(<AdminPlansPageClient />);

    expect(await screen.findByText('noPlansFound')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
