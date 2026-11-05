import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentSession, getPostSignInHref, cookieStore, redirectMock } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getPostSignInHref: vi.fn(),
  cookieStore: { has: vi.fn() },
  redirectMock: vi.fn((target: { href: string; locale: string }): never => {
    throw new Error(`redirect:${target.locale}:${target.href}`);
  }),
}));

vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(cookieStore) }));
vi.mock('@/i18n/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/auth/session', () => ({ getCurrentSession }));
vi.mock('@/lib/dashboard-factory', () => ({ getPostSignInHref }));

import StartPage from './page';

function renderStart(locale = 'vi') {
  return StartPage({ params: Promise.resolve({ locale }) });
}

describe('/start post-sign-in landing (RIN-913)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.has.mockReturnValue(false);
    getCurrentSession.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('sends a signed-out visitor to sign-in without a callback', async () => {
    getCurrentSession.mockResolvedValue(null);

    await expect(renderStart('en')).rejects.toThrow('redirect:en:/login');
    expect(getPostSignInHref).not.toHaveBeenCalled();
  });

  it('redirects to the target the dashboard service picks, in the UI locale', async () => {
    getPostSignInHref.mockResolvedValue('/quiz/fake-starter?entry=post_signin_starter');

    await expect(renderStart('vi')).rejects.toThrow(
      'redirect:vi:/quiz/fake-starter?entry=post_signin_starter',
    );
    expect(getPostSignInHref).toHaveBeenCalledWith({
      userId: 'user-1',
      locale: 'vi',
      starterSkipped: false,
    });
    expect(cookieStore.has).toHaveBeenCalledWith('rk_starter_skipped');
  });

  it('passes the skip cookie through', async () => {
    cookieStore.has.mockReturnValue(true);
    getPostSignInHref.mockResolvedValue('/dashboard');

    await expect(renderStart('en')).rejects.toThrow('redirect:en:/dashboard');
    expect(getPostSignInHref).toHaveBeenCalledWith(
      expect.objectContaining({ starterSkipped: true }),
    );
  });
});
