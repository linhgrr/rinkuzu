import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({ useTranslations: () => translate }));

import { BookmarkPanel } from './BookmarkPanel';

describe('BookmarkPanel message', () => {
  it('gives the dismiss control an accessible name', () => {
    const onDismissMessage = vi.fn();
    render(
      <BookmarkPanel
        bookmarkMessage="Saved to bookmarks"
        bookmarkMessageTone="success"
        onDismissMessage={onDismissMessage}
        bookmarkToRemove={null}
        bookmarkLoading={new Set()}
        onCancelRemove={vi.fn()}
        onConfirmRemove={vi.fn()}
        t={(key) => key}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'dismissBookmarkMessage' }));

    expect(onDismissMessage).toHaveBeenCalledOnce();
  });
});
