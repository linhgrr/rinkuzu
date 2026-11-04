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

  function authorOf(html: string): unknown {
    const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    return (JSON.parse(json) as { author: unknown }).author;
  }

  // RIN-840: a real name gives a Person, nothing else ever does.
  it('names a Person only from the real author name', () => {
    const html = renderToStaticMarkup(
      <QuizPageSchema locale="en" quizSlug="biology" quizTitle="Biology" authorName="  Lan Anh " />,
    );

    expect(authorOf(html)).toEqual({ '@type': 'Person', name: 'Lan Anh' });
  });

  it.each([undefined, '', '   '])(
    'falls back to the RinKuzu Organization when the name is %j',
    (authorName) => {
      const html = renderToStaticMarkup(
        <QuizPageSchema
          locale="en"
          quizSlug="biology"
          quizTitle="Biology"
          {...(authorName === undefined ? {} : { authorName })}
        />,
      );

      expect(authorOf(html)).toEqual({
        '@type': 'Organization',
        name: 'RinKuzu',
        url: expect.stringMatching(/^https?:\/\//),
      });
      expect(html).not.toContain('"name":"User"');
      expect(html).not.toContain('"@type":"Person"');
    },
  );
});
