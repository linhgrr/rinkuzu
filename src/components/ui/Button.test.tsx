/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('keeps an accessible name and disables interaction while loading', async () => {
    const { container, rerender } = render(<Button>Save changes</Button>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    expect((await axe(container)).violations).toEqual([]);

    rerender(<Button loading>Save changes</Button>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('gives the destructive variant a 3px focus ring Tailwind 3.4 can generate', () => {
    render(<Button variant="destructive">Delete quiz</Button>);
    const button = screen.getByRole('button', { name: 'Delete quiz' });

    expect(button).toHaveClass('focus-visible:outline-[3px]');
    expect(button).not.toHaveClass('focus-visible:outline-3');
  });
});
