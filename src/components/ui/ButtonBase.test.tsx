/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ButtonBase } from './ButtonBase';

describe('ButtonBase', () => {
  it('defaults to a non-submitting button', () => {
    render(<ButtonBase>Action</ButtonBase>);

    expect(screen.getByRole('button', { name: 'Action' })).toHaveAttribute('type', 'button');
  });

  it('preserves an explicit submit type', () => {
    render(<ButtonBase type="submit">Submit</ButtonBase>);

    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
  });
});
