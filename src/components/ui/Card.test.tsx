/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Badge } from './Card';

describe('Badge', () => {
  it.each([
    ['success', 'badge-success'],
    ['info', 'badge-info'],
    ['purple', 'badge-purple'],
  ] as const)('maps %s to its semantic token class', async (variant, expectedClass) => {
    const { container } = render(<Badge variant={variant}>{variant}</Badge>);

    expect(container.firstChild).toHaveClass(expectedClass);
    expect((await axe(container)).violations).toEqual([]);
  });
});
