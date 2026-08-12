/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PDFViewer from '@/features/quiz/components/PDFViewer';

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

    render(
      <PDFViewer
        pdfDataUrl="blob:https://rinkuzu.test/source"
        pdfUrl="https://files.rinkuzu.test/source.pdf"
        onClose={onClose}
      />,
    );

    const frame = screen.getByTitle('PDF Viewer') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBe(
      'blob:https://rinkuzu.test/source#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=page-width',
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    await user.click(buttons[0]);
    expect(openInNewTabSafelyMock).toHaveBeenCalledWith('https://files.rinkuzu.test/source.pdf');

    await user.click(buttons[1]);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.load(frame);
    expect(screen.queryByText('Loading PDF')).toBeNull();
  });

  it('keeps the original fragment when the inline source already configures the viewer', () => {
    render(
      <PDFViewer
        pdfDataUrl="blob:https://rinkuzu.test/source#page=3"
        pdfUrl={null}
        onClose={vi.fn()}
        showHeader={false}
      />,
    );

    expect((screen.getByTitle('PDF Viewer') as HTMLIFrameElement).getAttribute('src')).toBe(
      'blob:https://rinkuzu.test/source#page=3',
    );
  });
});
