import { describe, expect, it } from 'vitest';
import {
  collectQuizTexts,
  detectPersonalData,
  resolveQuizContentFlags,
  type QuizTextSource,
} from '@/lib/quiz/personal-data';

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

  it('checks a 100-question quiz in under 50 ms', () => {
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
    detectPersonalData(texts); // warm the regex engine
    const started = performance.now();
    const result = detectPersonalData(texts);
    const elapsed = performance.now() - started;

    expect(result.kinds).toEqual([]);
    expect(elapsed).toBeLessThan(50);
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
