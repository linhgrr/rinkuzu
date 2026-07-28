/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Select } from './Select';

describe('Select', () => {
  it('associates its label and helper text with the native select', async () => {
    const { container } = render(
      <Select label="Visibility" helperText="Controls who can see this quiz" defaultValue="public">
        <option value="public">Public</option>
        <option value="private">Private</option>
      </Select>,
    );

    const select = screen.getByRole('combobox', { name: 'Visibility' });
    expect(select).toHaveAccessibleDescription('Controls who can see this quiz');
    expect(select).not.toHaveAttribute('aria-invalid');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('exposes errors through aria-invalid and aria-describedby', async () => {
    const { container } = render(
      <Select label="Status" error="Choose a status">
        <option value="">Select one</option>
      </Select>,
    );

    const select = screen.getByRole('combobox', { name: 'Status' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Choose a status');
    expect((await axe(container)).violations).toEqual([]);
  });
});
