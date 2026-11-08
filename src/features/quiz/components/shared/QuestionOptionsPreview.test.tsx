/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { QuestionOptionsPreview } from './QuestionOptionsPreview';

// KaTeX loads on demand (RIN-679); its first import is a cold transform in vitest.
const KATEX_LOAD = { timeout: 10_000 };

describe('QuestionOptionsPreview', () => {
  it('keeps correct and non-correct option states distinct', () => {
    const { container } = render(
      <QuestionOptionsPreview
        options={['Correct answer', 'Distractor']}
        correctIndexes={[0]}
        correctLabel="Correct"
        optionItemClassName="normal-option"
        highlightedOptionItemClassName="correct-option"
      />,
    );

    const markers = container.querySelectorAll('.border-2');
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveClass('border-green-500', 'bg-green-500');
    expect(markers[0].querySelector('svg')).not.toBeNull();
    expect(markers[1]).not.toHaveClass('border-green-500', 'bg-green-500');
    expect(markers[1].querySelector('svg')).toBeNull();
    expect(container.querySelector('.correct-option')).not.toBeNull();
    expect(container.querySelector('.normal-option')).not.toBeNull();
    expect(screen.getAllByText(/Correct/)).toHaveLength(2);
  });
  it('renders Markdown and math consistently for the prompt and every option', async () => {
    const { container } = render(
      <QuestionOptionsPreview
        questionText={'Find **all** values satisfying $x^2 = 4$.'}
        options={['$x = 2$', '$x = -2$']}
        correctIndexes={[0, 1]}
        correctLabel="Correct"
      />,
    );
    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(3), KATEX_LOAD);

    expect(screen.getByText('all')).toHaveProperty('tagName', 'STRONG');
    expect(screen.getAllByText(/Correct/)).toHaveLength(2);
    expect(container.querySelectorAll('[data-rich-text="option"]')).toHaveLength(2);
    expect((await axe(container)).violations).toEqual([]);
  });
});
