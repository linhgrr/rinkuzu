import { afterEach, describe, expect, it, vi } from 'vitest';

const { disableDevtoolMock } = vi.hoisted(() => ({
  disableDevtoolMock: vi.fn(),
}));

vi.mock('disable-devtool', () => ({
  default: disableDevtoolMock,
}));

describe('instrumentation client browser protection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.getElementById('rinkuzu-devtool-guard')?.remove();
    document.getElementById('rinkuzu-devtool-guard-style')?.remove();
    delete document.documentElement.dataset['rinkuzuDevtoolsOpen'];
  });

  it('does not initialize outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    disableDevtoolMock.mockReset();

    await import('../instrumentation-client');

    expect(disableDevtoolMock).not.toHaveBeenCalled();
  });

  it('blocks entry points without redirecting and guards content while DevTools are detected', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    disableDevtoolMock.mockReset();

    await import('../instrumentation-client');

    expect(disableDevtoolMock).toHaveBeenCalledOnce();
    const options = disableDevtoolMock.mock.calls[0]?.[0];

    expect(options).toMatchObject({
      disableMenu: true,
      clearLog: true,
      disableCopy: false,
      disableCut: false,
      disablePaste: false,
    });
    expect(options).not.toHaveProperty('url');
    expect(options).not.toHaveProperty('timeOutUrl');

    options.ondevtoolopen();
    expect(document.documentElement.dataset['rinkuzuDevtoolsOpen']).toBe('true');
    expect(document.getElementById('rinkuzu-devtool-guard')).not.toBeNull();

    options.ondevtoolclose();
    expect(document.documentElement.dataset['rinkuzuDevtoolsOpen']).toBeUndefined();
    expect(document.getElementById('rinkuzu-devtool-guard')).toBeNull();

    const shortcut = new KeyboardEvent('keydown', {
      key: 'F12',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(shortcut);
    expect(shortcut.defaultPrevented).toBe(true);
  });
});
