import { describe, expect, it } from 'vitest';
import { detectContentLocale } from '@/lib/content-locale';

describe('detectContentLocale (RIN-1265)', () => {
  it('detects Vietnamese from letters no other supported locale uses', () => {
    expect(detectContentLocale('Cách ghi nhớ những gì bạn học')).toBe('vi');
    expect(detectContentLocale('Lich su', 'Ôn tập chương một')).toBe('vi');
    expect(detectContentLocale('Đề thi')).toBe('vi');
  });

  it('detects decomposed (NFD) Vietnamese text', () => {
    expect(detectContentLocale('Kinh tế vĩ mô'.normalize('NFD'))).toBe('vi');
  });

  it('returns null when the language is unknown, so callers keep every locale', () => {
    expect(detectContentLocale('Cell biology', undefined, null, '')).toBeNull();
    expect(detectContentLocale('Café crème')).toBeNull();
    expect(detectContentLocale()).toBeNull();
  });
});
