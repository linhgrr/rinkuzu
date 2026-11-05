/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { AddFolderModal } from './AddFolderModal';
import { FoldersView } from './FoldersView';

const { createFolderMock, foldersState, mutateMock, routerPushMock, toastErrorMock } = vi.hoisted(
  () => ({
    createFolderMock: vi.fn(),
    foldersState: { error: undefined as unknown },
    mutateMock: vi.fn(),
    routerPushMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }),
);

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/my-quizzes',
  useRouter: () => ({ push: routerPushMock, back: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }));

vi.mock('../hooks/useFolders', () => ({
  useFolders: () => ({
    folders: [],
    unfiledCount: 0,
    isLoading: false,
    error: foldersState.error,
    mutate: mutateMock,
  }),
}));

vi.mock('@/features/folders/api/folders-api', () => ({
  createFolderViewModel: createFolderMock,
  deleteFolderViewModel: vi.fn(),
  renameFolderViewModel: vi.fn(),
}));

const failure = (status: number, code: string) =>
  new ApiResponseError({
    message: 'E11000 duplicate key folders.owner learner@example.com',
    status,
    payload: { success: false, error: { code } },
    code,
    detail: 'E11000 duplicate key folders.owner learner@example.com',
  });

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  foldersState.error = undefined;
});

describe('FoldersView load failure (RIN-755)', () => {
  it('renders an inline ErrorState whose retry revalidates the list', async () => {
    const user = userEvent.setup();
    foldersState.error = failure(503, 'service_unavailable');

    render(<FoldersView />);

    expect(screen.getByText('errors.api.unavailable')).toBeTruthy();
    expect(document.body.textContent).not.toContain('E11000');

    await user.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it('offers sign-in when the session expired', () => {
    foldersState.error = failure(401, 'unauthorized');

    render(<FoldersView />);

    expect(
      screen.getByRole('link', { name: 'errors.api.actions.signIn' }).getAttribute('href'),
    ).toBe(`/login?callbackUrl=${encodeURIComponent('/my-quizzes')}`);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('AddFolderModal create failure (RIN-755)', () => {
  it('toasts localized copy, never the server text', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    createFolderMock.mockRejectedValueOnce(failure(500, 'internal_error'));
    const onCreated = vi.fn();

    render(<AddFolderModal isOpen onClose={vi.fn()} onCreated={onCreated} />);
    await user.type(screen.getByLabelText('folderName'), 'Biology');
    await user.click(screen.getByRole('button', { name: 'createFolder' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('errors.api.server'));
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain('E11000');
    expect(document.body.textContent).not.toContain('E11000');
    expect(onCreated).not.toHaveBeenCalled();
    // The submit button is released so the learner can retry (reset lives in `finally`).
    expect(screen.getByRole('button', { name: 'createFolder' })).toBeEnabled();
  });
});
