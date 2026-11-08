/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Input } from './Input';

describe('Input accessibility (RIN-1017)', () => {
  afterEach(cleanup);

  it('ties the hint to the field while there is no error', () => {
    render(<Input label="New password" hint="At least 8 characters" />);

    const field = screen.getByLabelText('New password');
    const hint = screen.getByText('At least 8 characters');
    expect(field.getAttribute('aria-describedby')).toBe(hint.id);
    expect(field.getAttribute('aria-invalid')).toBeNull();
  });

  it('announces the error, marks the field invalid and replaces the hint', () => {
    render(
      <Input
        label="Current password"
        hint="At least 8 characters"
        error="Wrong password"
        aria-describedby="extra"
      />,
    );

    const field = screen.getByLabelText('Current password');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Wrong password');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(`extra ${alert.id}`);
    expect(screen.queryByText('At least 8 characters')).toBeNull();
  });
});
