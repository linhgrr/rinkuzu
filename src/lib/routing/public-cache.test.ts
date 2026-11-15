import { describe, expect, it } from 'vitest';
import { publicPathForInternalTwin, publicPathname, signedOutTwinPath } from './public-cache';

describe('signedOutTwinPath', () => {
  const noCookies: string[] = [];

  it.each([
    ['/vi/explore', '/vi/signed-out/explore'],
    ['/en/explore', '/en/signed-out/explore'],
    ['/vi/explore/', '/vi/signed-out/explore'],
    ['/vi/explore/toan-hoc', '/vi/signed-out/explore/toan-hoc'],
    ['/en/explore/toan-hoc', '/en/signed-out/explore/toan-hoc'],
  ])('rewrites a signed-out GET of %s to %s', (pathname, twin) => {
    expect(signedOutTwinPath('GET', pathname, noCookies)).toBe(twin);
    expect(signedOutTwinPath('HEAD', pathname, noCookies)).toBe(twin);
  });

  it.each([
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.session-token.0',
    '__Secure-authjs.session-token.1',
  ])('treats %s as a session without decoding it', (name) => {
    expect(signedOutTwinPath('GET', '/vi/explore', ['NEXT_LOCALE', name])).toBeNull();
  });

  it.each([[['NEXT_LOCALE']], [['authjs.csrf-token', 'authjs.callback-url']]])(
    'finds no session in %j',
    (names) => {
      expect(signedOutTwinPath('GET', '/vi/explore', names)).toBe('/vi/signed-out/explore');
    },
  );

  it.each(['/vi/explore', '/vi/explore/toan-hoc'])(
    'keeps %s dynamic when any session cookie is present, valid or not',
    (pathname) => {
      expect(signedOutTwinPath('GET', pathname, ['__Secure-authjs.session-token'])).toBeNull();
      expect(signedOutTwinPath('GET', pathname, ['authjs.session-token.0'])).toBeNull();
    },
  );

  it.each(['POST', 'PUT', 'DELETE'])('leaves a %s unchanged', (method) => {
    expect(signedOutTwinPath(method, '/vi/explore', noCookies)).toBeNull();
  });

  it.each([
    '/explore',
    '/de/explore',
    '/vi/explorer',
    '/vi/explore/a/b',
    '/vi/dashboard',
    '/vi/signed-out/explore',
    '/api/explore',
  ])('leaves %s unchanged', (pathname) => {
    expect(signedOutTwinPath('GET', pathname, noCookies)).toBeNull();
  });
});

describe('publicPathForInternalTwin', () => {
  it.each([
    ['/vi/signed-out/explore', '/vi/explore'],
    ['/en/signed-out/explore/toan-hoc', '/en/explore/toan-hoc'],
    ['/vi/signed-out', '/vi'],
  ])('sends a direct request for %s to %s', (pathname, publicPath) => {
    expect(publicPathForInternalTwin(pathname)).toBe(publicPath);
  });

  it.each(['/vi/explore', '/vi/signed-outx', '/signed-out/explore'])('ignores %s', (pathname) => {
    expect(publicPathForInternalTwin(pathname)).toBeNull();
  });
});

describe('publicPathname', () => {
  it.each([
    ['/signed-out/explore', '/explore'],
    ['/signed-out/explore/toan-hoc', '/explore/toan-hoc'],
    ['/signed-out', '/'],
    ['/explore', '/explore'],
    ['/signed-outx', '/signed-outx'],
    ['/', '/'],
  ])('reports %s as %s', (pathname, expected) => {
    expect(publicPathname(pathname)).toBe(expected);
  });
});

describe('signedOutTwinPath for a quiz page (RIN-1647)', () => {
  it.each([
    ['/vi/quiz/toan-12', ''],
    ['/vi/quiz/toan-12/', '?'],
    ['/en/quiz/toan-12', ''],
  ])('rewrites %s only without a query', (pathname, search) => {
    expect(signedOutTwinPath('GET', pathname, [], search)).toBe(
      pathname.replace(/\/quiz\/([^/]+)\/?$/, '/signed-out/quiz/$1'),
    );
  });

  it.each(['?mode=quick', '?entry=hub&topic=a', '?retryOf=x', '?view=play', '?a=1'])(
    'keeps the dynamic route for the query %s',
    (search) => {
      expect(signedOutTwinPath('GET', '/vi/quiz/toan-12', [], search)).toBeNull();
    },
  );

  it.each(['/vi/quiz/toan-12/flashcards', '/vi/quiz/toan-12/result', '/vi/quiz', '/de/quiz/a'])(
    'leaves %s unchanged',
    (pathname) => {
      expect(signedOutTwinPath('GET', pathname, [], '')).toBeNull();
    },
  );

  it('keeps the dynamic route when any session cookie is present', () => {
    expect(
      signedOutTwinPath('GET', '/vi/quiz/a', ['__Secure-authjs.session-token'], ''),
    ).toBeNull();
  });

  it('still serves /explore whatever its query', () => {
    expect(signedOutTwinPath('GET', '/vi/explore', [], '?q=a')).toBe('/vi/signed-out/explore');
  });

  it('maps the internal quiz twin path back to the public one', () => {
    expect(publicPathForInternalTwin('/vi/signed-out/quiz/toan-12')).toBe('/vi/quiz/toan-12');
    expect(publicPathname('/signed-out/quiz/toan-12')).toBe('/quiz/toan-12');
  });
});
