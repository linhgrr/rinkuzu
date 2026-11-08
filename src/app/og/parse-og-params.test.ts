import { describe, expect, it } from 'vitest';
import { parseOgParams } from './parse-og-params';

function parse(query: string) {
  return parseOgParams(new URLSearchParams(query));
}

describe('parseOgParams (RIN-1180)', () => {
  it('keeps the title-only card when no count is given', () => {
    expect(parse('title=Biology%20basics')).toEqual({
      title: 'Biology basics',
      eyebrow: 'rinkuzu.app',
      detail: null,
    });
  });

  it('shows the question count in Vietnamese by default', () => {
    expect(parse('title=Sinh%20h%E1%BB%8Dc&count=42').detail).toBe('42 câu hỏi');
  });

  it('shows the question count in English for lang=en', () => {
    expect(parse('title=Biology&count=42&lang=en').detail).toBe('42 questions');
  });

  it('adds the quick-round duration for quick=1', () => {
    expect(parse('count=40&quick=1').detail).toBe('40 câu hỏi · ~3 phút');
    expect(parse('count=40&quick=1&lang=en').detail).toBe('40 questions · ~3 min');
  });

  it.each(['abc', '-1', '0', '1000', '100000', '1.5', '12abc', ' 7', ''])(
    'ignores the invalid count %j',
    (count) => {
      expect(parse(`count=${encodeURIComponent(count)}&quick=1`).detail).toBeNull();
    },
  );

  it('accepts the bounds 1 and 999', () => {
    expect(parse('count=1').detail).toBe('1 câu hỏi');
    expect(parse('count=999&lang=en').detail).toBe('999 questions');
  });

  it('shows nothing for quick without a count', () => {
    expect(parse('quick=1&lang=en').detail).toBeNull();
  });

  it('ignores quick values other than 1 and unknown languages', () => {
    expect(parse('count=20&quick=true&lang=fr').detail).toBe('20 câu hỏi');
  });

  it('clamps long titles and eyebrows', () => {
    const parsed = parse(`title=${'a'.repeat(300)}&eyebrow=${'b'.repeat(300)}`);
    expect(parsed.title).toHaveLength(110);
    expect(parsed.title.endsWith('…')).toBe(true);
    expect(parsed.eyebrow.length).toBeLessThanOrEqual(40);
  });
});
