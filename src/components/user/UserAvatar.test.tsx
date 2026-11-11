import { render, screen } from '@testing-library/react';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import { ImageConfigContext } from 'next/dist/shared/lib/image-config-context.shared-runtime';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import remotePatterns from '@/lib/images/remote-patterns.json';

import { UserAvatar } from './UserAvatar';

// next/image validates hosts against the app's image config; give it the real list.
const imageConfig = {
  ...imageConfigDefault,
  remotePatterns: remotePatterns.map((pattern) => ({
    ...pattern,
    protocol: pattern.protocol === 'http' ? ('http' as const) : ('https' as const),
  })),
};

function WithImageConfig({ children }: { children: ReactNode }) {
  return <ImageConfigContext.Provider value={imageConfig}>{children}</ImageConfigContext.Provider>;
}

describe('UserAvatar', () => {
  it('serves an allowed-host avatar through the image optimizer at its rendered size', () => {
    render(
      <UserAvatar
        user={{ displayName: 'Rin', avatar: 'https://cdn.rinkuzu.app/images/migrated/a.png' }}
        size={26}
      />,
      { wrapper: WithImageConfig },
    );

    const img = screen.getByRole('img', { name: 'Rin avatar' });
    const src = img.getAttribute('src') ?? '';
    expect(src).toMatch(/^\/_next\/image\?url=/);
    expect(src).toContain(encodeURIComponent('https://cdn.rinkuzu.app/images/migrated/a.png'));
    const widths = [...(img.getAttribute('srcset') ?? '').matchAll(/[?&]w=(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.max(...widths)).toBeLessThanOrEqual(64);
  });

  it('renders an avatar from a host outside remotePatterns unoptimized', () => {
    const avatar = 'https://lh3.googleusercontent.com/a/photo=s96-c';
    render(<UserAvatar user={{ displayName: 'Rin', avatar }} size={26} />, {
      wrapper: WithImageConfig,
    });

    const img = screen.getByRole('img', { name: 'Rin avatar' });
    expect(img.getAttribute('src')).toBe(avatar);
    expect(img.getAttribute('srcset')).toBeNull();
  });

  it('falls back to the initial when there is no avatar', () => {
    const { container } = render(<UserAvatar user={{ displayName: 'rin' }} size={26} />, {
      wrapper: WithImageConfig,
    });

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).toBe('R');
  });
});
