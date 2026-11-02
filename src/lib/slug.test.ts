import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHeadingSlugger, generateSlug } from './slug';
import { generateSlug as generateSlugFromUtils } from './utils';

// The first id from a fresh heading slugger is the plain transliterated slug.
const slugifyText = (text: string) => createHeadingSlugger()(text);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('slugifyText (first id of a fresh heading slugger)', () => {
  it.each([
    ['a family', 'ả ã á ạ à a', 'a-a-a-a-a-a'],
    ['ă family', 'ẳ ẵ ắ ặ ằ ă', 'a-a-a-a-a-a'],
    ['â family', 'ẩ ẫ ấ ậ ầ â', 'a-a-a-a-a-a'],
    ['e family', 'ẻ ẽ é ẹ è e', 'e-e-e-e-e-e'],
    ['ê family', 'ể ễ ế ệ ề ê', 'e-e-e-e-e-e'],
    ['i family', 'ỉ ĩ í ị ì i', 'i-i-i-i-i-i'],
    ['o family', 'ỏ õ ó ọ ò o', 'o-o-o-o-o-o'],
    ['ô family', 'ổ ỗ ố ộ ồ ô', 'o-o-o-o-o-o'],
    ['ơ family', 'ở ỡ ớ ợ ờ ơ', 'o-o-o-o-o-o'],
    ['u family', 'ủ ũ ú ụ ù u', 'u-u-u-u-u-u'],
    ['ư family', 'ử ữ ứ ự ừ ư', 'u-u-u-u-u-u'],
    ['y family', 'ỷ ỹ ý ỵ ỳ y', 'y-y-y-y-y-y'],
    ['uppercase with tones', 'ẢÃÁẠÀ ƯƠÔÊÂĂ', 'aaaaa-uooeaa'],
    ['đ and Đ', 'đi Đà Nẵng', 'di-da-nang'],
  ])('transliterates the %s', (_label, input, expected) => {
    expect(slugifyText(input)).toBe(expected);
  });

  it('transliterates precomposed and decomposed input the same way', () => {
    expect(slugifyText('Tiếng Việt'.normalize('NFC'))).toBe('tieng-viet');
    expect(slugifyText('Tiếng Việt'.normalize('NFD'))).toBe('tieng-viet');
  });

  it('collapses separator runs and trims edge dashes', () => {
    expect(slugifyText('  --Hello,   World!!--  ')).toBe('hello-world');
    expect(slugifyText('snake_case & more')).toBe('snake-case-more');
  });

  it('drops apostrophes instead of splitting on them', () => {
    expect(slugifyText("Bloom's Taxonomy")).toBe('blooms-taxonomy');
    expect(slugifyText('RinKuzu\u2019s Approach')).toBe('rinkuzus-approach');
  });

  it('falls back to "section" when nothing slug-worthy remains', () => {
    expect(slugifyText('🔥🔥')).toBe('section');
    expect(slugifyText('!!!')).toBe('section');
    expect(slugifyText('   ')).toBe('section');
  });
});

describe('generateSlug', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1714201234567);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('transliterates a Vietnamese quiz title', () => {
    expect(generateSlug('Cách ghi nhớ những gì bạn học… Quiz khởi động 7 câu')).toBe(
      'cach-ghi-nho-nhung-gi-ban-hoc-quiz-khoi-dong-7-cau-234567',
    );
  });

  it('handles mixed Vietnamese and English titles', () => {
    expect(generateSlug('Chương 3: Data Structures')).toBe('chuong-3-data-structures-234567');
  });

  it.each(['🔥🔥', '!!!', '   ', ''])('falls back to "quiz" for %j', (title) => {
    const slug = generateSlug(title);
    expect(slug).toBe('quiz-234567');
    expect(slug).toMatch(SLUG_PATTERN);
  });

  it('keeps the slug ordinary English titles got before', () => {
    expect(generateSlug('Hello World!')).toBe('hello-world-234567');
    expect(generateSlug("What's New in Biology 101")).toBe('whats-new-in-biology-101-234567');
  });

  it('is still exported from utils', () => {
    expect(generateSlugFromUtils).toBe(generateSlug);
  });
});

describe('createHeadingSlugger', () => {
  it('suffixes repeated headings so ids stay unique within one document', () => {
    const slug = createHeadingSlugger();
    expect(['Tổng quan', 'Tong quan', 'Tổng quan'].map(slug)).toEqual([
      'tong-quan',
      'tong-quan-2',
      'tong-quan-3',
    ]);
  });

  it('skips a suffix that a literal heading already took', () => {
    const slug = createHeadingSlugger();
    expect(['Step', 'Step 2', 'Step'].map(slug)).toEqual(['step', 'step-2', 'step-3']);
  });

  it('falls back to "section" when nothing slug-worthy remains', () => {
    const slug = createHeadingSlugger();
    expect(['🚀', '!!!'].map(slug)).toEqual(['section', 'section-2']);
  });

  it('starts every slugger with a clean slate', () => {
    expect(createHeadingSlugger()('Intro')).toBe('intro');
    expect(createHeadingSlugger()('Intro')).toBe('intro');
  });
});
