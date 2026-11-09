import { describe, expect, it } from 'vitest';
import { findUnsafeBodyConstruct } from './body-safety';

describe('findUnsafeBodyConstruct (RIN-1329)', () => {
  it.each([
    ['an import line', "import { Quiz } from '@/components/Quiz';", /import\/export/],
    ['a side-effect import', "import './styles.css';", /import\/export/],
    ['an export line', 'export const meta = 1;', /import\/export/],
    ['an MDX expression', 'Score: {props.score}', /expression/],
    ['a lone closing brace', 'end }', /expression/],
    ['an HTML tag', '<div class="x">hi</div>', /tag `<div`/],
    ['a closing tag', 'text </span>', /tag `<\/span`/],
    ['a self-closing JSX component', '<Foo />', /tag `<Foo`/],
    ['a member JSX component', '<Foo.Bar>', /tag `<Foo.Bar`/],
    ['a script tag', '<script>alert(1)</script>', /tag `<script`/],
    ['a tag opened at line end', 'before <div', /tag `<div`/],
    ['an HTML comment', '<!-- hidden -->', /tag `<!--`/],
    ['a JSX fragment', '<>text</>', /tag `<>`/],
    ['a javascript: link', '[click](javascript:alert(1))', /scheme `javascript:`/],
    ['a data: image', '![x](data:image/png;base64,AAAA)', /scheme `data:`/],
    ['an upper-case scheme', '[x](JavaScript:alert(1))', /scheme `javascript:`/],
    ['a link with a title', '[x](vbscript:run "title")', /scheme `vbscript:`/],
    ['a reference definition', '[ref]: javascript:alert(1)', /scheme `javascript:`/],
    ['an autolink', '<ftp://files.example.com>', /scheme `ftp:`/],
  ])('rejects %s', (_label, line, reason) => {
    const unsafe = findUnsafeBodyConstruct(`## Title\n\n${line}\n`);
    expect(unsafe?.line).toBe(3);
    expect(unsafe?.reason).toMatch(reason);
  });

  it.each([
    ['prose', 'Learning is easier with personalized quizzes, 2 < 3 and 5 > 4.'],
    ['a GFM table', '| a | b |\n| - | - |\n| 1 | 2 |'],
    ['inline code', 'Use `{value}`, `<div>` and ``a ` {b}`` freely.'],
    ['escaped braces and tags', String.raw`An escaped \{ and \<b\> render literally.`],
    [
      'http, https, mailto and relative links',
      '[a](http://x.y) [b](https://x.y) [c](mailto:a@b.c) [d](/en/faq) [e](#top) [f](../x)',
    ],
    ['an image', '![alt](https://images.unsplash.com/photo-1?w=800)'],
    ['URL and email autolinks', '<https://www.rinkuzu.app> <hello@example.com>'],
    ['a prose line starting with import', 'import your PDF and start'],
    ['a fenced block', '```tsx\nimport x from "y";\n<Foo bar={1} />\n```'],
    ['a tilde fence', '~~~\n{x}\n~~~'],
    ['an indented fence in a list', '- step\n\n  ```\n  <div>\n  ```'],
    ['a longer fence containing a shorter one', '````md\n```\n{x}\n```\n<div>\n````'],
  ])('accepts %s', (_label, body) => {
    expect(findUnsafeBodyConstruct(body)).toBeUndefined();
  });

  it('checks prose again after a fence closes', () => {
    expect(findUnsafeBodyConstruct('```\n{ok}\n```\n{not ok}')).toEqual({
      line: 4,
      reason: expect.stringMatching(/expression/),
    });
  });

  it('treats an unclosed fence as code to the end of the body', () => {
    expect(findUnsafeBodyConstruct('text\n```\n<div>')).toBeUndefined();
  });

  it('counts CRLF lines', () => {
    expect(findUnsafeBodyConstruct('a\r\nb\r\n<div>')?.line).toBe(3);
  });
});
