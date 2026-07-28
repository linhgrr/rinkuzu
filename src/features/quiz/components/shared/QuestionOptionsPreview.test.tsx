/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { QuestionOptionsPreview } from './QuestionOptionsPreview';

describe('QuestionOptionsPreview', () => {
  it('renders Markdown and math consistently for the prompt and every option', async () => {
    const { container } = render(
      <QuestionOptionsPreview
        questionText={'Find **all** values satisfying $x^2 = 4$.'}
        options={['$x = 2$', '$x = -2$']}
        correctIndexes={[0, 1]}
        correctLabel="Correct"
      />,
    );

    expect(screen.getByText('all')).toHaveProperty('tagName', 'STRONG');
    expect(container.querySelectorAll('.katex')).toHaveLength(3);
    expect(screen.getAllByText(/Correct/)).toHaveLength(2);
    expect(container.querySelectorAll('[data-rich-text="option"]')).toHaveLength(2);
    expect((await axe(container)).violations).toEqual([]);
  });
});
