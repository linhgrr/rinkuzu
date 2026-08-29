/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketingPreferencePrompt } from './MarketingPreferencePrompt';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  pathname: vi.fn(() => '/dashboard'),
  saveMarketingPreferences: vi.fn(),
  swr: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => (key: string) => key,
}));
vi.mock('swr', () => ({ default: (...args: unknown[]) => mocks.swr(...args) }));
vi.mock('@/i18n/navigation', () => ({ usePathname: () => mocks.pathname() }));
vi.mock('../api/communications-api', () => ({
  fetchMarketingPreferences: vi.fn(),
  saveMarketingPreferences: (...args: unknown[]) => mocks.saveMarketingPreferences(...args),
}));

/** The prompt is shown only to someone who has never answered it. */
function unanswered(): void {
  mocks.swr.mockReturnValue({
    data: { productUpdates: false, promotions: false },
    mutate: mocks.mutate,
  });
}

function alreadyAnswered(): void {
  mocks.swr.mockReturnValue({
    data: { productUpdates: true, promotions: false, updatedAt: '2026-08-01T00:00:00.000Z' },
    mutate: mocks.mutate,
  });
}

const promptFlag = (): string | null => document.documentElement.getAttribute('data-bottom-prompt');

/**
 * The prompt is a fixed banner over the app, and the failure it caused was not
 * a rendering bug: it was positioned independently of both the bottom
 * navigation under it and the page content behind it, so on every phone-sized
 * viewport it sat on top of whatever was at the bottom of the page. On the
 * subscription page that was the Subscribe button, which is how a marketing
 * opt-in prompt ended up blocking checkout.
 *
 * These assertions pin the contract that stops it recurring: while the banner
 * is up it declares itself, so content can reserve the band; when it goes, the
 * declaration goes with it.
 */
describe('the marketing preference prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutate.mockResolvedValue(undefined);
    mocks.pathname.mockReturnValue('/dashboard');
    mocks.saveMarketingPreferences.mockResolvedValue({});
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-bottom-prompt');
  });

  it('reserves space for itself while it is on screen', () => {
    unanswered();

    render(<MarketingPreferencePrompt />);

    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(promptFlag()).toBe('true');
  });

  it('sits above the bottom navigation rather than across it', () => {
    // The regression in one assertion: the banner used to be pinned at
    // `bottom-4`, the same strip the mobile navigation occupies.
    unanswered();

    render(<MarketingPreferencePrompt />);

    const banner = screen.getByRole('complementary');
    expect(banner.className).toContain('app-bottom-prompt');
    expect(banner.className).not.toMatch(/(^|\s)bottom-4(\s|$)/);
  });

  it('claims no space when the question has already been answered', () => {
    alreadyAnswered();

    render(<MarketingPreferencePrompt />);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(promptFlag()).toBeNull();
  });

  it('claims no space before the preferences have loaded', () => {
    mocks.swr.mockReturnValue({ data: undefined, mutate: mocks.mutate });

    render(<MarketingPreferencePrompt />);

    expect(promptFlag()).toBeNull();
  });

  it('releases the space it reserved when dismissed', async () => {
    // Dismissal has to give the band back. A reservation that outlives the
    // banner is dead space under every page for the rest of the session.
    unanswered();
    render(<MarketingPreferencePrompt />);
    expect(promptFlag()).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'later' }));

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(promptFlag()).toBeNull();
  });

  it.each([
    ['a quiz in progress', '/quiz/photosynthesis-basics'],
    ['an adaptive exercise', '/adaptive/exercise/session-1'],
    ['an adaptive result', '/adaptive/result/session-1'],
  ])('stays away from %s', (_label, path) => {
    // Floating an unrelated opt-in over someone working through a question
    // covers the answers they are reading and asks them to decide something
    // else first. Reserving the band keeps content reachable; not appearing
    // here is what keeps the task uninterrupted.
    unanswered();
    mocks.pathname.mockReturnValue(path);

    render(<MarketingPreferencePrompt />);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(promptFlag()).toBeNull();
  });

  it('still appears on an ordinary browsing page', () => {
    unanswered();
    mocks.pathname.mockReturnValue('/quizzes');

    render(<MarketingPreferencePrompt />);

    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('releases the space it reserved when unmounted', () => {
    unanswered();
    const { unmount } = render(<MarketingPreferencePrompt />);
    expect(promptFlag()).toBe('true');

    unmount();

    expect(promptFlag()).toBeNull();
  });
});
