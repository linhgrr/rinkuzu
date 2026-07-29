import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuizPageSchema } from './QuizPageSchema';

describe('QuizPageSchema', () => {
  it('renders truthful quiz structured data without fabricated ratings or credits', () => {
    const html = renderToStaticMarkup(
      <QuizPageSchema
        locale="vi"
        quizSlug="giai-tich-1"
        quizTitle="Giải tích 1"
        quizDescription="Ôn tập đạo hàm và tích phân."
        authorName="RinKuzu Community"
        createdAt="2026-07-01T00:00:00.000Z"
        updatedAt="2026-07-02T00:00:00.000Z"
      />,
    );

    expect(html).toContain('"@type":"Quiz"');
    expect(html).toContain('"inLanguage":"vi"');
    expect(html).toContain('"learningResourceType":"Quiz"');
    expect(html).not.toContain('aggregateRating');
    expect(html).not.toContain('numberOfCredits');
  });
});
