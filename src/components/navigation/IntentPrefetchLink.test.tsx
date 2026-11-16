// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import type { AnchorHTMLAttributes } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IntentPrefetchLink } from './IntentPrefetchLink';

const prefetch = vi.fn();
const linkProps = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ prefetch }),
  Link: ({
    href,
    prefetch: p,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => {
    linkProps({ prefetch: p });
    return <a href={href} {...rest} />;
  },
}));

describe('IntentPrefetchLink', () => {
  it('does not prefetch on mount and disables the viewport prefetch', () => {
    prefetch.mockClear();
    render(<IntentPrefetchLink href="/quiz/a">Quiz A</IntentPrefetchLink>);
    expect(prefetch).not.toHaveBeenCalled();
    expect(linkProps).toHaveBeenLastCalledWith({ prefetch: false });
  });

  it('prefetches once on hover, focus or touch', () => {
    prefetch.mockClear();
    const onFocus = vi.fn();
    render(
      <IntentPrefetchLink href="/quiz/a" onFocus={onFocus} className="card">
        Quiz A
      </IntentPrefetchLink>,
    );
    const link = screen.getByRole('link', { name: 'Quiz A' });
    expect(link).toHaveClass('card');
    fireEvent.pointerEnter(link);
    fireEvent.focus(link);
    fireEvent.touchStart(link);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith('/quiz/a');
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
