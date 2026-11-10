/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { current: null as { user: { id: string } } | null },
  CreateQuizHubPage: vi.fn(() => null),
  GuestCreateHubPage: vi.fn(() => null),
}));

vi.mock('@/lib/auth/session', () => ({ getCurrentSession: async () => mocks.session.current }));
vi.mock('@/features/quiz/components/create/CreateQuizHubPage', () => ({
  CreateQuizHubPage: mocks.CreateQuizHubPage,
}));
vi.mock('@/features/guest-draft/components/GuestCreateHubPage', () => ({
  GuestCreateHubPage: mocks.GuestCreateHubPage,
}));

import CreateQuizRoutePage from './page';

describe('/create page (RIN-1473)', () => {
  it('shows a signed-out visitor the guest hub instead of the drafts hub', async () => {
    mocks.session.current = null;
    const page = await CreateQuizRoutePage();
    expect(page.type).toBe(mocks.GuestCreateHubPage);
  });

  it('keeps the drafts hub for a signed-in learner', async () => {
    mocks.session.current = { user: { id: 'user-1' } };
    const page = await CreateQuizRoutePage();
    expect(page.type).toBe(mocks.CreateQuizHubPage);
  });
});
