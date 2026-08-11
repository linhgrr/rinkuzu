import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GoogleAuthButton } from './GoogleAuthButton';

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock('next-auth/react', () => ({ signIn: signInMock }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./GoogleLogo', () => ({ GoogleLogo: () => null }));

describe('GoogleAuthButton', () => {
  it('marks the login before starting the external authentication redirect', async () => {
    const onBeforeSignIn = vi.fn();
    const user = userEvent.setup();
    render(<GoogleAuthButton callbackUrl="/en/explore" onBeforeSignIn={onBeforeSignIn} />);

    await user.click(screen.getByRole('button', { name: 'continueWithGoogle' }));

    expect(onBeforeSignIn).toHaveBeenCalledOnce();
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/en/explore' });
    expect(onBeforeSignIn.mock.invocationCallOrder[0]).toBeLessThan(
      signInMock.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
