import { describe, expect, it } from 'vitest';
import {
  MIN_INDEXABLE_QUESTION_COUNT,
  buildQuizSeoDescription,
  buildQuizSeoTitle,
  detectQuizContentLocale,
  isQuizIndexable,
} from './quiz-indexability';

describe('isQuizIndexable (RIN-1241 D13)', () => {
  const indexable = { visibility: 'public', ownerIndexable: true, questionCount: 5 } as const;

  it('indexes a public quiz of an indexable owner with at least 5 questions', () => {
    expect(MIN_INDEXABLE_QUESTION_COUNT).toBe(5);
    expect(isQuizIndexable(indexable)).toBe(true);
    expect(isQuizIndexable({ ...indexable, questionCount: 120 })).toBe(true);
  });

  it('keeps a quiz with fewer than 5 questions out of search', () => {
    expect(isQuizIndexable({ ...indexable, questionCount: 4 })).toBe(false);
    expect(isQuizIndexable({ ...indexable, questionCount: 0 })).toBe(false);
  });

  it('keeps a test or company owner quiz out of search (RIN-840)', () => {
    expect(isQuizIndexable({ ...indexable, ownerIndexable: false })).toBe(false);
  });

  it('keeps a personal quiz out of search', () => {
    expect(isQuizIndexable({ ...indexable, visibility: 'personal' })).toBe(false);
  });
});

describe('detectQuizContentLocale (RIN-1241 D14)', () => {
  it('reads a Vietnamese title as vi', () => {
    expect(detectQuizContentLocale('Chương 1 KTPM', [])).toBe('vi');
  });

  it('reads a title without diacritics as vi when the questions are Vietnamese', () => {
    expect(
      detectQuizContentLocale('chương 1 ktpm'.normalize('NFD').replace(/\p{M}/gu, ''), [
        'Kiểm thử phần mềm là gì?',
        'Mục tiêu của kiểm thử đơn vị?',
      ]),
    ).toBe('vi');
  });

  it('reads an English quiz as en', () => {
    expect(
      detectQuizContentLocale('Intro to AI', [
        'What is a neural network?',
        'Which algorithm is greedy?',
      ]),
    ).toBe('en');
  });

  it('does not flip an English quiz to vi on a loanword accent', () => {
    expect(detectQuizContentLocale('Café chemistry', ['What is a résumé?'])).toBe('en');
  });

  it('handles decomposed (NFD) Vietnamese text', () => {
    expect(detectQuizContentLocale('Lịch sử Việt Nam'.normalize('NFD'), [])).toBe('vi');
  });

  it('reads đ as Vietnamese', () => {
    expect(detectQuizContentLocale('Đề cương đại số', [])).toBe('vi');
  });

  it('reads a title with one Vietnamese-only letter as vi when the questions are Japanese (RIN-1294)', () => {
    expect(
      detectQuizContentLocale('Nhật ngành 2 FULL (Form K67)', [
        '次のうち、情報セキュリティの三要素に含まれないものはどれか。',
        'ファイアウォールの主な役割は何か。',
      ]),
    ).toBe('vi');
  });

  it('reads a quiz without any Latin letters as vi (RIN-1294)', () => {
    expect(
      detectQuizContentLocale('情報セキュリティ(1)', [
        '次のうち、情報セキュリティの三要素に含まれないものはどれか。',
        '公開鍵暗号方式で、送信者が暗号化に使う鍵はどれか。',
      ]),
    ).toBe('vi');
  });

  it('keeps an English title en when one question names a Vietnamese person (RIN-1294)', () => {
    expect(
      detectQuizContentLocale('Intro to AI', [
        'Which model did Nguyễn train first?',
        'What is a neural network?',
      ]),
    ).toBe('en');
  });

  it('keeps a title with only loanword accents en (RIN-1294)', () => {
    expect(detectQuizContentLocale('Café résumé tips', [])).toBe('en');
  });
});

describe('buildQuizSeoTitle (RIN-1241 C10)', () => {
  it('uses the Vietnamese pattern for a vi quiz', () => {
    expect(buildQuizSeoTitle('Chương 1 KTPM', 40, 'vi')).toBe(
      'Chương 1 KTPM – 40 câu trắc nghiệm có đáp án | RinKuzu',
    );
  });

  it('uses the English pattern for an en quiz', () => {
    expect(buildQuizSeoTitle('Intro to AI', 12, 'en')).toBe(
      'Intro to AI – 12 quiz questions with answers | RinKuzu',
    );
  });

  it('shortens a long quiz title at a word boundary to keep the whole near 65 chars', () => {
    const title = buildQuizSeoTitle(
      'Ôn tập kiểm thử phần mềm chương 1 đến chương 5 học kỳ 2 năm 2026',
      30,
      'vi',
    );

    expect(title.length).toBeLessThanOrEqual(65);
    expect(title).toBe('Ôn tập kiểm thử phần… – 30 câu trắc nghiệm có đáp án | RinKuzu');
  });

  it('hard-cuts a single very long word', () => {
    const title = buildQuizSeoTitle('A'.repeat(80), 5, 'en');

    expect(title.length).toBeLessThanOrEqual(65);
    expect(title.endsWith(' – 5 quiz questions with answers | RinKuzu')).toBe(true);
  });
});

describe('buildQuizSeoDescription (RIN-1241 C10)', () => {
  it('keeps an owner description of at least 50 characters', () => {
    const description = 'Bộ đề ôn tập chương 1 môn Kiểm thử phần mềm, có giải thích chi tiết.';

    expect(
      buildQuizSeoDescription({
        title: 'Chương 1 KTPM',
        description,
        questionCount: 40,
        firstQuestionText: 'Kiểm thử là gì?',
        locale: 'vi',
      }),
    ).toBe(description);
  });

  it('generates a Vietnamese description when the owner description is short', () => {
    expect(
      buildQuizSeoDescription({
        title: 'Chương 1 KTPM',
        description: 'Ôn thi',
        questionCount: 40,
        firstQuestionText: '<b>Kiểm thử</b> phần mềm là gì?',
        locale: 'vi',
      }),
    ).toBe(
      'Đề trắc nghiệm Chương 1 KTPM: 40 câu hỏi có đáp án và giải thích. Câu 1: Kiểm thử phần mềm là gì?',
    );
  });

  it('generates an English description for an en quiz', () => {
    expect(
      buildQuizSeoDescription({
        title: 'Intro to AI',
        questionCount: 12,
        firstQuestionText: 'What is a neural network?',
        locale: 'en',
      }),
    ).toBe(
      'Intro to AI quiz: 12 questions with answers and explanations. Q1: What is a neural network?',
    );
  });

  it('truncates a long first question so the description stays within 155 chars', () => {
    const description = buildQuizSeoDescription({
      title: 'Chương 1 KTPM',
      questionCount: 40,
      firstQuestionText: 'Trong quy trình kiểm thử phần mềm '.repeat(8),
      locale: 'vi',
    });

    expect(description.length).toBeLessThanOrEqual(155);
    expect(description.startsWith('Đề trắc nghiệm Chương 1 KTPM: 40 câu hỏi')).toBe(true);
    expect(description.endsWith('…')).toBe(true);
  });

  it('strips HTML and markdown from the question and collapses whitespace', () => {
    expect(
      buildQuizSeoDescription({
        title: 'Chương 1 KTPM',
        questionCount: 40,
        firstQuestionText:
          '<p>**Kiểm thử** là gì?</p>\n![hình](https://x.test/a.png) [xem](https://x.test) `code`',
        locale: 'vi',
      }),
    ).toBe(
      'Đề trắc nghiệm Chương 1 KTPM: 40 câu hỏi có đáp án và giải thích. Câu 1: Kiểm thử là gì? xem code',
    );
  });

  it('omits the question part when there is no question text', () => {
    expect(buildQuizSeoDescription({ title: 'Intro to AI', questionCount: 12, locale: 'en' })).toBe(
      'Intro to AI quiz: 12 questions with answers and explanations.',
    );
  });
});
