import { describe, expect, it } from 'vitest';
import { hasMath } from './has-math';

describe('hasMath', () => {
  it.each([
    ['empty content', ''],
    ['plain text', 'Which organelle produces ATP?'],
    ['markdown without math', 'Choose **two** answers:\n\n- `code`\n- [link](https://example.com)'],
    ['a single price', 'The ticket costs $5.'],
    ['escaped prices', 'It costs \\$5 or \\$10 per month.'],
    ['an escaped price next to a lone dollar', 'From \\$5 up to $10.'],
    ['backslashes that are not LaTeX delimiters', 'Path C:\\Users\\docs and a\\b'],
  ])('is false for %s', (_label, content) => {
    expect(hasMath(content)).toBe(false);
  });

  it.each([
    ['inline math', 'Solve $x^2 = 4$.'],
    ['block math', 'Evaluate:\n\n$$\n\\int_0^1 x\\,dx\n$$'],
    ['inline block delimiters', '$$a + b$$'],
    ['LaTeX inline parentheses', 'Let \\(x = 2\\).'],
    ['LaTeX display brackets', '\\[ E = mc^2 \\]'],
    ['a LaTeX environment', '\\begin{pmatrix} 1 & 0 \\end{pmatrix}'],
    ['a dollar after an escaped backslash', 'Path \\\\$x$ here'],
    ['two unescaped prices (remark-math reads them as math)', 'Pay $5 now and $10 later.'],
  ])('is true for %s', (_label, content) => {
    expect(hasMath(content)).toBe(true);
  });
});
