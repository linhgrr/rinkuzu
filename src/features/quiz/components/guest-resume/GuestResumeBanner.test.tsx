/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../../messages/en/guestDraft.json';
import viGuest from '../../../../../messages/vi/guestDraft.json';
import {
  GUEST_CLAIMS_STORAGE_KEY,
  addGuestClaim,
  consumeResumeBannerSignIn,
  type GuestClaim,
} from '@/features/quiz/lib/guest-claims';

vi.mock('next/dynamic', () => import('next/dist/api/app-dynamic'));

const { captureMock, signInMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  signInMock: vi.fn(),
}));

vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: (...args: unknown[]) => captureMock(...args),
}));
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
  useSession: () => sessionState.value,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const sessionState = { value: { data: null, status: 'unauthenticated' } as object };

import { GuestResumeBanner } from './GuestResumeBanner';
import { GuestResumeBannerForApp } from './GuestResumeBannerForApp';

const HOUR = 60 * 60 * 1000;
const messages = { en: { guestDraft: enGuest }, vi: { guestDraft: viGuest } } as const;

function claim(overrides: Partial<GuestClaim> & { attemptId: string }): GuestClaim {
  return {
    token: 'T'.repeat(43),
    quizSlug: 'fake quiz/1',
    takenAt: Date.now() - 3 * HOUR - 5 * 60 * 1000,
    ...overrides,
  };
}

function withIntl(node: ReactNode, locale: 'en' | 'vi') {
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {node}
    </NextIntlClientProvider>
  );
}

async function renderBanner(locale: 'en' | 'vi' = 'vi', node?: ReactNode) {
  const view = render(
    withIntl(node ?? <GuestResumeBanner page="landing" mainId="main-x" />, locale),
  );
  // The strip is a lazy chunk: wait for it to land.
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

describe('GuestResumeBanner (RIN-1714)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.cookie = 'x=1';
    sessionState.value = { data: null, status: 'unauthenticated' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing on the server and with no claim', async () => {
    addGuestClaim(claim({ attemptId: 'a', score: 71, quizTitle: 'Fake quiz' }));
    expect(renderToString(withIntl(<GuestResumeBanner page="try" mainId="m" />, 'vi'))).toBe('');

    window.localStorage.clear();
    await renderBanner();
    expect(screen.queryByRole('region')).toBeNull();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('shows the score, the title and the age of one claim, once per page view', async () => {
    addGuestClaim(claim({ attemptId: 'a', score: 71, quizTitle: 'Fake quiz title' }));
    await renderBanner('vi');

    const region = await screen.findByRole('region', {
      name: 'Kết quả bài quiz đã lưu trên thiết bị này',
    });
    expect(region).toHaveTextContent('Kết quả của bạn vẫn còn: 71%');
    expect(region).toHaveTextContent('Fake quiz title');
    expect(region.textContent).not.toContain('khác');
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith('guest_resume_banner_shown', {
      page: 'landing',
      claim_age_hours: 3,
    });
  });

  it('counts the other claims and links the newest one', async () => {
    addGuestClaim(claim({ attemptId: 'old', takenAt: Date.now() - 30 * HOUR, score: 10 }));
    addGuestClaim(claim({ attemptId: 'mid', takenAt: Date.now() - 20 * HOUR, score: 20 }));
    addGuestClaim(claim({ attemptId: 'new', score: 90, quizTitle: 'Newest' }));
    await renderBanner('en');

    const region = await screen.findByRole('region', { name: 'Quiz result saved on this device' });
    expect(region).toHaveTextContent('Your result is still here: 90%');
    expect(region).toHaveTextContent('+2 other results');
    expect(screen.getByRole('link', { name: 'See it' })).toHaveAttribute(
      'href',
      '/quiz/fake%20quiz%2F1/result?attemptId=new&score=90',
    );
  });

  it('uses the plural form for one other result', async () => {
    addGuestClaim(claim({ attemptId: 'old', takenAt: Date.now() - 30 * HOUR }));
    addGuestClaim(claim({ attemptId: 'new', score: 50 }));
    await renderBanner('en');
    expect(await screen.findByRole('region')).toHaveTextContent('+1 other result');
    expect(screen.getByRole('region').textContent).not.toContain('+1 other results');
  });

  it('shows a legacy claim with neither score nor title', async () => {
    addGuestClaim(claim({ attemptId: 'legacy' }));
    await renderBanner('vi');
    const region = await screen.findByRole('region');
    expect(region).toHaveTextContent('Kết quả bài quiz của bạn');
    expect(region.textContent).not.toContain('%');
    expect(screen.getByRole('link', { name: 'Xem lại' })).toHaveAttribute(
      'href',
      '/quiz/fake%20quiz%2F1/result?attemptId=legacy',
    );
  });

  it('shows the hours left of a draft claim and never its title', async () => {
    addGuestClaim(claim({ attemptId: 'd', kind: 'draft', score: 80, quizTitle: 'Secret doc' }));
    await renderBanner('vi');
    const region = await screen.findByRole('region');
    expect(region).toHaveTextContent('Quiz từ tài liệu của bạn sẽ bị xóa sau 21 giờ');
    expect(region.textContent).not.toContain('Secret doc');
  });

  it('keeps one hour on a draft claim that is about to expire', async () => {
    addGuestClaim(claim({ attemptId: 'd', kind: 'draft', takenAt: Date.now() - 23.9 * HOUR }));
    await renderBanner('en');
    expect(await screen.findByRole('region')).toHaveTextContent(
      'Your quiz from your document will be deleted in 1 h',
    );
  });

  it('renders a hostile title as plain text', async () => {
    addGuestClaim(claim({ attemptId: 'x', score: 1, quizTitle: '<img src=x onerror=alert(1)>' }));
    await renderBanner('en');
    const region = await screen.findByRole('region');
    expect(region.querySelector('img')).toBeNull();
    expect(region).toHaveTextContent('<img src=x onerror=alert(1)>');
  });

  it('starts Google sign-in on the result page, marks the claim source and reports the click', async () => {
    signInMock.mockResolvedValue(undefined);
    addGuestClaim(claim({ attemptId: 'g', score: 64, quizTitle: 'Q' }));
    await renderBanner('vi');

    fireEvent.click(await screen.findByRole('button', { name: 'Lưu với Google' }));

    expect(signInMock).toHaveBeenCalledWith('google', {
      callbackUrl: '/vi/quiz/fake%20quiz%2F1/result?attemptId=g&score=64',
    });
    expect(captureMock).toHaveBeenCalledWith('guest_resume_banner_clicked', {
      page: 'landing',
      claim_age_hours: 3,
      target: 'google',
    });
    expect(consumeResumeBannerSignIn()).toBe(true);
    expect(consumeResumeBannerSignIn()).toBe(false);
  });

  it('goes back to idle when starting sign-in fails and keeps the strip', async () => {
    signInMock.mockRejectedValue(new Error('offline'));
    addGuestClaim(claim({ attemptId: 'g', score: 64 }));
    await renderBanner('en');
    const save = await screen.findByRole('button', { name: 'Save with Google' });
    await act(async () => {
      fireEvent.click(save);
    });
    expect(screen.getByRole('button', { name: 'Save with Google' })).toBeEnabled();
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('reports the See it click with its target and no ids', async () => {
    addGuestClaim(claim({ attemptId: 'secret-attempt', score: 64, quizTitle: 'Secret title' }));
    await renderBanner('en');
    fireEvent.click(await screen.findByRole('link', { name: 'See it' }));
    const events = JSON.stringify(captureMock.mock.calls);
    expect(captureMock).toHaveBeenCalledWith('guest_resume_banner_clicked', {
      page: 'landing',
      claim_age_hours: 3,
      target: 'view',
    });
    expect(events).not.toContain('secret-attempt');
    expect(events).not.toContain('Secret title');
    expect(events).not.toContain('fake');
  });

  it('closes, remembers the dismissal, reports it and moves focus to the main landmark', async () => {
    const main = document.createElement('main');
    main.id = 'main-x';
    main.tabIndex = -1;
    document.body.append(main);
    addGuestClaim(claim({ attemptId: 'c', score: 64 }));
    const view = await renderBanner('en');

    const close = await screen.findByRole('button', { name: 'Dismiss saved result notice' });
    fireEvent.click(close);

    expect(screen.queryByRole('region')).toBeNull();
    expect(view.container).toBeEmptyDOMElement();
    expect(document.activeElement).toBe(main);
    expect(captureMock).toHaveBeenCalledWith('guest_resume_banner_dismissed', {
      page: 'landing',
      claim_age_hours: 3,
    });

    // A reload finds the claim dismissed.
    view.unmount();
    await renderBanner('en');
    expect(screen.queryByRole('region')).toBeNull();
    main.remove();
  });

  it('tabs in visual order: Save with Google, See it, Close', async () => {
    addGuestClaim(claim({ attemptId: 'c', score: 64 }));
    await renderBanner('en');
    const region = await screen.findByRole('region');
    const stops = Array.from(region.querySelectorAll('button, a')).map(
      (el) => el.getAttribute('aria-label') ?? el.textContent?.trim(),
    );
    expect(stops).toEqual(['Save with Google', 'See it', 'Dismiss saved result notice']);
  });

  it('is not a fixed or sticky overlay and has no live region', async () => {
    addGuestClaim(claim({ attemptId: 'c', score: 64 }));
    await renderBanner('en');
    const region = await screen.findByRole('region');
    expect(region.className).not.toMatch(/\b(fixed|sticky)\b/);
    expect(region).not.toHaveAttribute('aria-live');
    expect(region).not.toHaveAttribute('role', 'alert');
  });

  it('gives the landing strip the header band back', async () => {
    addGuestClaim(claim({ attemptId: 'c', score: 64 }));
    await renderBanner(
      'vi',
      <GuestResumeBanner page="landing" tone="dark" placement="landing" mainId="m" />,
    );
    const region = await screen.findByRole('region');
    expect(region).toHaveClass('mt-20', '-mb-20', 'bg-white/5');
  });

  it('survives unreadable and disabled storage by rendering nothing', async () => {
    window.localStorage.setItem(GUEST_CLAIMS_STORAGE_KEY, '{not json');
    await renderBanner();
    expect(screen.queryByRole('region')).toBeNull();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    await renderBanner();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('is hidden when disabled', async () => {
    addGuestClaim(claim({ attemptId: 'c', score: 64 }));
    await renderBanner('en', <GuestResumeBanner page="try" mainId="m" enabled={false} />);
    expect(screen.queryByRole('region')).toBeNull();
  });
});

describe('GuestResumeBannerForApp (RIN-1714)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    sessionState.value = { data: null, status: 'unauthenticated' };
  });

  it('shows for a signed-out session', async () => {
    addGuestClaim(claim({ attemptId: 'c', score: 64 }));
    await renderBanner('en', <GuestResumeBannerForApp page="explore" mainId="m" />);
    expect(await screen.findByRole('region')).toBeInTheDocument();
  });

  it.each(['authenticated', 'loading'])('hides while the session is %s', async (status) => {
    sessionState.value = { data: null, status };
    addGuestClaim(claim({ attemptId: 'c', score: 64 }));
    await renderBanner('en', <GuestResumeBannerForApp page="explore" mainId="m" />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('appears once the session settles as signed out', async () => {
    sessionState.value = { data: null, status: 'loading' };
    addGuestClaim(claim({ attemptId: 'c', score: 64 }));
    const view = await renderBanner('en', <GuestResumeBannerForApp page="explore" mainId="m" />);
    expect(screen.queryByRole('region')).toBeNull();

    sessionState.value = { data: null, status: 'unauthenticated' };
    // A fresh element: React skips a child whose element is the same object.
    view.rerender(withIntl(<GuestResumeBannerForApp page="explore" mainId="m" />, 'en'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(await screen.findByRole('region')).toBeInTheDocument();
  });
});
