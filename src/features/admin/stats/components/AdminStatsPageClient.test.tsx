import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchAdminStatsViewModelMock } = vi.hoisted(() => ({
  fetchAdminStatsViewModelMock: vi.fn(),
}));

// Translation keys are the assertion surface; the copy is covered by the i18n gate.
// Stable `t`: the admin error hook is a load-effect dependency.
const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({
  useTranslations: () => translate,
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
vi.mock('@/features/admin/stats/components/ReviewEmailSection', () => ({
  ReviewEmailSection: () => <section>review-email-panel</section>,
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

    expect(await screen.findByText('errors.api.generic')).toBeInTheDocument();
    expect(await screen.findByText('review-email-panel')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'statsWorkspaceLearnerLookup' }));

    expect(await screen.findByText('learner-lookup-workspace')).toBeInTheDocument();
    expect(screen.queryByText('errors.api.generic')).not.toBeInTheDocument();
  });
});
