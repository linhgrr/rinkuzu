/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PDFViewer from '@/features/quiz/components/PDFViewer';
import enQuiz from '../../../../messages/en/quiz.json';
import viQuiz from '../../../../messages/vi/quiz.json';

function renderIn(locale: 'en' | 'vi', ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ quiz: locale === 'en' ? enQuiz : viQuiz }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const { openInNewTabSafelyMock } = vi.hoisted(() => ({
  openInNewTabSafelyMock: vi.fn(),
}));

vi.mock('@/lib/security/trusted-navigation', () => ({
  openInNewTabSafely: openInNewTabSafelyMock,
}));

describe('PDFViewer', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the source with viewer controls and preserves header actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderIn(
      'en',
      <PDFViewer
        pdfDataUrl="blob:https://rinkuzu.test/source"
        pdfUrl="https://files.rinkuzu.test/source.pdf"
        onClose={onClose}
      />,
    );

    const frame = screen.getByTitle('PDF viewer') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBe(
      'blob:https://rinkuzu.test/source#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=page-width',
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Open in new tab' }));
    expect(openInNewTabSafelyMock).toHaveBeenCalledWith('https://files.rinkuzu.test/source.pdf');

    await user.click(screen.getByRole('button', { name: 'Close PDF' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.load(frame);
    expect(screen.queryByText('Loading PDF')).toBeNull();
  });

  it('keeps the original fragment when the inline source already configures the viewer', () => {
    renderIn(
      'en',
      <PDFViewer
        pdfDataUrl="blob:https://rinkuzu.test/source#page=3"
        pdfUrl={null}
        onClose={vi.fn()}
        showHeader={false}
      />,
    );

    expect((screen.getByTitle('PDF viewer') as HTMLIFrameElement).getAttribute('src')).toBe(
      'blob:https://rinkuzu.test/source#page=3',
    );
  });

  it('shows no Vietnamese on /en and keeps the Vietnamese labels on /vi (RIN-1265)', () => {
    const props = {
      pdfDataUrl: null,
      pdfUrl: 'https://files.rinkuzu.test/a.pdf',
      onClose: vi.fn(),
    };
    const { container, unmount } = renderIn('en', <PDFViewer {...props} />);
    expect(container.textContent).not.toContain('Mở tab mới');
    expect(screen.getByRole('heading', { name: 'PDF reference' })).toBeTruthy();
    unmount();

    renderIn('vi', <PDFViewer {...props} />);
    expect(screen.getByRole('button', { name: 'Mở tab mới' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đóng PDF' })).toBeTruthy();
  });
});
