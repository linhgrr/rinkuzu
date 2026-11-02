import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchAdminStatsViewModelMock } = vi.hoisted(() => ({
  fetchAdminStatsViewModelMock: vi.fn(),
}));

// Translation keys are the assertion surface; the copy is covered by the i18n gate.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/features/admin/stats/api/admin-stats-api', () => ({
  fetchAdminStatsViewModel: fetchAdminStatsViewModelMock,
  fetchGrowthTrendsViewModel: vi.fn(),
}));
// The workspaces load their own data; only their presence matters here.
vi.mock('@/features/admin/stats/components/LearnerLookupSection', () => ({
  LearnerLookupSection: () => <section>learner-lookup-workspace</section>,
}));
vi.mock('@/features/admin/stats/components/PersonalLearningSection', () => ({
  PersonalLearningSection: () => <section>personal-learning-workspace</section>,
}));
vi.mock('@/features/admin/stats/components/LlmUsageSection', () => ({
  LlmUsageSection: () => <section>llm-workspace</section>,
}));
vi.mock('@/features/admin/stats/components/EntitlementTelemetrySection', () => ({
  EntitlementTelemetrySection: () => <section>entitlements-workspace</section>,
}));
vi.mock('@/features/admin/stats/components/StatsModal', () => ({ default: () => null }));

import { AdminStatsPageClient } from './AdminStatsPageClient';

describe('AdminStatsPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the other workspaces reachable when the overview statistics fail to load', async () => {
    fetchAdminStatsViewModelMock.mockRejectedValue(new Error('Failed to fetch statistics'));

    render(<AdminStatsPageClient />);

    expect(await screen.findByText('Failed to fetch statistics')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'statsWorkspaceLearnerLookup' }));

    expect(await screen.findByText('learner-lookup-workspace')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch statistics')).not.toBeInTheDocument();
  });
});
