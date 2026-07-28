import { describe, expect, it } from 'vitest';
import { normalizeMarkdownContent } from './normalize';

describe('normalizeMarkdownContent', () => {
  it('recovers control characters created by legacy JSON LaTeX escaping', () => {
    expect(normalizeMarkdownContent('$\u000crac{1}{2} + \u0008eta$')).toBe(
      '$\\frac{1}{2} + \\beta$',
    );
  });

  it('leaves ordinary markdown unchanged', () => {
    const content = '**bold** and $x^2$';
    expect(normalizeMarkdownContent(content)).toBe(content);
  });
});
