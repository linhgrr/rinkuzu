import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));

vi.mock('@/auth', () => ({ signOut: signOutMock }));

import { POST } from '@/app/api/session/logout/route';

const SESSION_COOKIE = 'authjs.session-token=fake-session-token';

function logoutRequest(
  locale: string,
  reason?: string,
  cookie: string | null = SESSION_COOKIE,
): Request {
  return new Request('http://localhost/api/session/logout', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams({ locale, ...(reason ? { reason } : {}) }),
  });
}

describe('POST /api/session/logout', () => {
  beforeEach(() => {
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({
      redirect: 'http://localhost/en',
      cookies: [
        {
          name: 'authjs.callback-url',
          value: 'http%3A%2F%2Flocalhost%2Fen',
          options: { httpOnly: true, path: '/', sameSite: 'lax' },
        },
        {
          name: 'authjs.session-token',
          value: '',
          options: { httpOnly: true, maxAge: 0, path: '/', sameSite: 'lax' },
        },
      ],
    });
  });

  it('clears the Auth.js session and redirects to the localized home', async () => {
    const response = await POST(logoutRequest('en'));

    expect(signOutMock).toHaveBeenCalledWith({ redirect: false, redirectTo: '/en' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/en');
    expect(response.headers.getSetCookie()).toContain(
      'authjs.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=lax',
    );
  });

  it('fails closed to the default locale for malformed form input', async () => {
    await POST(logoutRequest('malicious-locale'));

    expect(signOutMock).toHaveBeenCalledWith({ redirect: false, redirectTo: '/vi' });
  });

  it('redirects a replaced session to localized login with its explanation', async () => {
    signOutMock.mockResolvedValue({
      redirect: 'http://localhost/vi/login?reason=session_replaced',
      cookies: [
        {
          name: 'authjs.session-token',
          value: '',
          options: { httpOnly: true, maxAge: 0, path: '/', sameSite: 'lax' },
        },
      ],
    });

    const response = await POST(logoutRequest('vi', 'session_replaced'));

    expect(signOutMock).toHaveBeenCalledWith({
      redirect: false,
      redirectTo: '/vi/login?reason=session_replaced',
    });
    expect(response.headers.get('location')).toBe(
      'http://localhost/vi/login?reason=session_replaced',
    );
  });

  it('ignores an unrecognized logout reason', async () => {
    await POST(logoutRequest('en', 'https://attacker.example'));

    expect(signOutMock).toHaveBeenCalledWith({ redirect: false, redirectTo: '/en' });
  });

  it('fails closed if Auth.js does not return a session deletion cookie', async () => {
    signOutMock.mockResolvedValue({ redirect: 'http://localhost/en', cookies: [] });

    const response = await POST(logoutRequest('en'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'internal_error' },
    });
  });

  it('redirects a guest without a session cookie home instead of failing (RIN-958)', async () => {
    signOutMock.mockResolvedValue({ redirect: 'http://localhost/vi', cookies: [] });

    const response = await POST(logoutRequest('vi', undefined, 'authjs.callback-url=%2Fvi'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/vi');
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('redirects a guest with no cookies at all to the replaced-session login (RIN-958)', async () => {
    const response = await POST(logoutRequest('en', 'session_replaced', null));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'http://localhost/en/login?reason=session_replaced',
    );
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('treats a chunked secure session cookie as a session', async () => {
    signOutMock.mockResolvedValue({ redirect: 'http://localhost/en', cookies: [] });

    const response = await POST(
      logoutRequest('en', undefined, 'theme=dark; __Secure-authjs.session-token.0=chunk'),
    );

    expect(signOutMock).toHaveBeenCalled();
    expect(response.status).toBe(500);
  });

  it('rejects an unexpected cross-origin redirect returned by Auth.js', async () => {
    signOutMock.mockResolvedValue({
      redirect: 'https://attacker.example',
      cookies: [
        {
          name: 'authjs.session-token',
          value: '',
          options: { httpOnly: true, maxAge: 0, path: '/', sameSite: 'lax' },
        },
      ],
    });

    const response = await POST(logoutRequest('en'));

    expect(response.headers.get('location')).toBe('http://localhost/en');
  });
});
