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
});
