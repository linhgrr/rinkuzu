import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExploreSearchInput } from './ExploreSearchInput';

function renderInput() {
  const onCommit = vi.fn();
  render(<ExploreSearchInput initialQuery="" placeholder="Search quizzes" onCommit={onCommit} />);
  const input = screen.getByRole('searchbox', { name: 'Search quizzes' });
  fireEvent.change(input, { target: { value: 'tiếng' } });
  return { input, onCommit };
}

describe('ExploreSearchInput Enter key', () => {
  it('searches when Enter is pressed outside an IME composition', () => {
    const { input, onCommit } = renderInput();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('tiếng');
  });

  it('does not search when Enter only confirms an IME composition', () => {
    const { input, onCommit } = renderInput();

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('ExploreSearchInput icon', () => {
  it('paints the search icon above the field background (RIN-1014)', () => {
    const { container } = render(
      <ExploreSearchInput initialQuery="" placeholder="Search quizzes" onCommit={vi.fn()} />,
    );

    // The Input wrapper is position:relative and comes later in the DOM, so an
    // absolute icon without a z-index is painted under the white field.
    expect(container.querySelector('search > svg')).toHaveClass('z-10');
  });
});
