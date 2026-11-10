import { describe, expect, it } from 'vitest';
import {
  collectQuizTexts,
  detectPersonalData,
  isPersonalDataFlagged,
  resolveQuizContentFlags,
  type QuizTextSource,
} from '@/lib/quiz/personal-data';
import { MAX_QUESTION_TEXT_LENGTH, MAX_QUESTIONS_PER_QUIZ } from '@/lib/validation/question';

// Fake data only: none of these values belongs to a real person.
function kindsOf(text: string) {
  return detectPersonalData([text]).kinds;
}

describe('detectPersonalData', () => {
  it.each([
    ['email', 'Liên hệ an.nguyen@example.com để nộp bài'],
    ['phone', 'Gọi 0912345678 nếu cần'],
    ['phone', 'SĐT: 0912 345 678'],
    ['phone', 'SĐT: 0912.345.678'],
    ['phone', 'Phone +84 912 345 678'],
    ['phone', 'Hotline 84912345678'],
    ['phone', 'Văn phòng 028 3823 4567'],
    ['phone', 'Năm 2020 gọi 0987-654-321'],
    ['id_number', 'Số 001203004567 trên thẻ'],
    ['id_number', 'Mã 123456789 của bạn'],
    ['id_number', 'MSSV: 20201234'],
    ['id_number', 'Mã số sinh viên là 2020123'],
    ['id_number', 'student ID #  20201234'],
    ['id_number', 'CCCD số 0012030045'],
    ['id_number', 'Danh sách: 001203012345, 001203012346, 001203012347'],
    ['id_number', 'Mã đề 123456789.'],
    ['labelled_name', 'Họ và tên: Nguyễn Văn An'],
    ['labelled_name', 'HỌ TÊN: TRẦN THỊ BÌNH'],
    ['labelled_name', 'Full name: Jane Doe'],
    ['labelled_name', 'Student name : Minh Le Hoang'],
  ] as const)('detects %s in %j', (kind, text) => {
    expect(kindsOf(text)).toContain(kind);
  });

  it('flags the RIN-552 header pattern', () => {
    const result = detectPersonalData([
      'Họ và tên: Nguyễn Văn An … MSSV: 20201234',
      'Câu 1: Thủ đô của Việt Nam là gì?',
    ]);
    expect(result).toEqual({ kinds: ['id_number', 'labelled_name'], fieldCount: 1 });
  });

  it.each([
    'Cách mạng tháng Tám thành công năm 1945',
    'Xem trang 123 và trang 2045 của giáo trình',
    'Hằng số Avogadro là 6.022×10^23 mol⁻¹',
    'Cho x = 123456789, tính x mod 9',
    'Tính 123456789012 × 3 + 1',
    'Kết quả: 102345678901 - 99',
    'π ≈ 3.141592653589',
    'Giá trị 0.912345678 là xác suất',
    'Số hiệu 1234091234567890 trong bảng',
    'Dãy 12345678 có 8 chữ số',
    'Nguyễn Văn An là tác giả của bài thơ',
    'Họ và tên: ................',
    'Họ và tên: nguyễn văn an',
    'Diện tích là 1,234,567,890 m²',
    'Số π xấp xỉ 3,141592653',
    'Phương trình 2x + 5 = 0912345678x',
    '@username trên mạng xã hội',
  ])('ignores %j', (text) => {
    expect(kindsOf(text)).toEqual([]);
  });

  it('counts fields, not matches, and returns no matched values', () => {
    const result = detectPersonalData([
      'a@example.com b@example.com',
      'plain text',
      '0912345678',
      '',
    ]);
    expect(result).toEqual({ kinds: ['email', 'phone'], fieldCount: 2 });
    expect(JSON.stringify(result)).not.toMatch(/example|0912/);
  });

  /**
   * Fastest of several timings. Load on the shared CI machine and coverage
   * instrumentation only ever add time, so the minimum is the detector's own
   * cost; a single wall-clock sample is not (RIN-1513).
   */
  function fastestRunMs(run: () => void, runs = 5): number {
    let fastest = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < runs; attempt += 1) {
      const started = performance.now();
      run();
      fastest = Math.min(fastest, performance.now() - started);
    }
    return fastest;
  }

  /**
   * The guard is against super-linear regexes (catastrophic backtracking), which
   * cost seconds on these inputs, not against a few ms of drift: the old 50 ms
   * bound on one sample went red at 96 ms under gate load (RIN-1513).
   */
  const BUDGET_MS = 250;

  it('checks a 100-question quiz well within budget', () => {
    const quiz: QuizTextSource = {
      title: 'Ôn tập Hóa học 10 năm 1945',
      description: 'Trang 123, hằng số 6.022×10^23. '.repeat(10),
      questions: Array.from({ length: 100 }, (_, index) => ({
        question:
          `Câu ${index + 1}: Cho x = 123456789, tính 2x + 0.5 với số mol 6.022×10^23. `.repeat(8),
        options: ['1945', '3.14159', 'Nguyễn Văn An là tác giả', 'x = 102345678901'].map((o) =>
          `${o} `.repeat(10),
        ),
      })),
    };
    const texts = collectQuizTexts(quiz);

    expect(detectPersonalData(texts).kinds).toEqual([]);
    expect(fastestRunMs(() => detectPersonalData(texts))).toBeLessThan(BUDGET_MS);
  });

  it('stays linear on crafted inputs at the size limits', () => {
    // Long runs that a backtracking pattern would retry from every position.
    const crafted = [
      'a'.repeat(MAX_QUESTION_TEXT_LENGTH),
      '1 '.repeat(MAX_QUESTION_TEXT_LENGTH / 2),
      '1.'.repeat(MAX_QUESTION_TEXT_LENGTH / 2),
      '1'.repeat(MAX_QUESTION_TEXT_LENGTH),
      `${' '.repeat(MAX_QUESTION_TEXT_LENGTH - 1)}=`,
      'a.'.repeat(MAX_QUESTION_TEXT_LENGTH / 2),
      'Họ và tên: '.repeat(MAX_QUESTION_TEXT_LENGTH / 11),
      'Họ và tên: An '.repeat(MAX_QUESTION_TEXT_LENGTH / 14),
      'MSSV '.repeat(MAX_QUESTION_TEXT_LENGTH / 5),
      `${'a'.repeat(MAX_QUESTION_TEXT_LENGTH - 2)} @`,
      'a@a.'.repeat(MAX_QUESTION_TEXT_LENGTH / 4),
      `x@${'a.'.repeat(MAX_QUESTION_TEXT_LENGTH / 2 - 1)}`,
    ];
    const texts = Array.from(
      { length: MAX_QUESTIONS_PER_QUIZ },
      (_, index) => crafted[index % crafted.length] ?? '',
    );

    expect(fastestRunMs(() => detectPersonalData(texts), 3)).toBeLessThan(BUDGET_MS);
  });
});

describe('resolveQuizContentFlags', () => {
  const now = new Date('2026-11-09T09:00:00Z');
  const clearedAt = new Date('2026-11-01T00:00:00Z');
  const adminId = '507f191e810c19729de860ff';
  const clean: QuizTextSource = {
    title: 'Hóa học',
    questions: [{ question: 'H2O là gì?', options: ['Nước', 'Muối'] }],
  };
  const withEmail: QuizTextSource = { ...clean, description: 'Gửi bài tới an@example.com' };
  const withEmailAndPhone: QuizTextSource = {
    ...withEmail,
    questions: [{ question: 'Gọi 0912345678', options: ['Có', 'Không'] }],
  };

  it('collects title, description, question texts and options', () => {
    expect(collectQuizTexts(withEmail)).toEqual([
      'Hóa học',
      'Gửi bài tới an@example.com',
      'H2O là gì?',
      'Nước',
      'Muối',
    ]);
  });

  it('flags personal data and unflags when an edit removes it', () => {
    const flagged = resolveQuizContentFlags(withEmail, undefined, now);
    expect(flagged).toEqual({ personalData: true, kinds: ['email'], checkedAt: now });

    expect(resolveQuizContentFlags(clean, flagged, now)).toEqual({
      personalData: false,
      kinds: [],
      checkedAt: now,
    });
  });

  it('keeps an admin clear while no new kind appears', () => {
    const cleared = {
      personalData: false,
      kinds: ['email'],
      checkedAt: clearedAt,
      clearedBy: adminId,
      clearedAt,
    };
    expect(resolveQuizContentFlags(withEmail, cleared, now)).toEqual({
      ...cleared,
      checkedAt: now,
    });
    expect(resolveQuizContentFlags(clean, cleared, now)).toEqual({ ...cleared, checkedAt: now });
  });

  it('drops an admin clear when an edit adds a kind not cleared', () => {
    const cleared = {
      personalData: false,
      kinds: ['email'],
      checkedAt: clearedAt,
      clearedBy: adminId,
      clearedAt,
    };
    expect(resolveQuizContentFlags(withEmailAndPhone, cleared, now)).toEqual({
      personalData: true,
      kinds: ['email', 'phone'],
      checkedAt: now,
    });
  });
});

describe('isPersonalDataFlagged (RIN-1341)', () => {
  const checkedAt = new Date('2026-11-01T00:00:00Z');

  it('is false for a quiz never checked or checked clean', () => {
    expect(isPersonalDataFlagged(undefined)).toBe(false);
    expect(isPersonalDataFlagged({ personalData: false })).toBe(false);
  });

  it('is true for a flag with no admin clear', () => {
    expect(isPersonalDataFlagged({ personalData: true })).toBe(true);
  });

  it('is false while an admin clear is in force', () => {
    const cleared = resolveQuizContentFlags(
      { title: 'Mail me at learner@example.com', questions: [] },
      {
        personalData: true,
        kinds: ['email'],
        checkedAt,
        clearedBy: '507f191e810c19729de860ea',
        clearedAt: checkedAt,
      },
      checkedAt,
    );
    expect(isPersonalDataFlagged(cleared)).toBe(false);
    expect(isPersonalDataFlagged({ personalData: true, clearedBy: 'admin-id' })).toBe(false);
  });
});
