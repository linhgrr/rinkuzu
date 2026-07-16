import { describe, expect, it } from 'vitest';
import { questionListSchema } from '@/lib/validation/question';

describe('questionListSchema option content', () => {
  it('accepts image-only options', () => {
    expect(
      questionListSchema.safeParse([
        {
          question: 'Choose an image',
          options: ['', ''],
          optionImages: ['https://example.com/a.png', 'https://example.com/b.png'],
          type: 'single',
          correctIndex: 0,
        },
      ]).success,
    ).toBe(true);
  });

  it('rejects contentless options and misaligned option images', () => {
    const contentless = questionListSchema.safeParse([
      {
        question: 'Question',
        options: ['', 'B'],
        type: 'single',
        correctIndex: 0,
      },
    ]);
    const misalignedImages = questionListSchema.safeParse([
      {
        question: 'Question',
        options: ['A', 'B'],
        optionImages: ['https://example.com/a.png'],
        type: 'single',
        correctIndex: 0,
      },
    ]);

    expect(contentless.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'Option requires text or an image' }),
      ]),
    );
    expect(misalignedImages.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Option images array length must match options array length',
        }),
      ]),
    );
  });
});
