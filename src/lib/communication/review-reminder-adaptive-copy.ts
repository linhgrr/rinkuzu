/**
 * Copy of the Path B review emails (RIN-1364): the d2 and d5 touches after an
 * adaptive completion. The document title and the number of due concepts only,
 * never questions or answers. Product term: personalized / cá nhân hóa, never
 * adaptive.
 */

type Locale = 'vi' | 'en';
type Touch = 'd2' | 'd5';

interface AdaptiveReviewCopy {
  subject: (title: string, due: number) => string;
  intro: (title: string, due: number) => string;
  why: string;
  button: (due: number) => string;
  footer: string;
  unsubscribe: string;
}

const concepts = (count: number) => `${count} ${count === 1 ? 'concept' : 'concepts'}`;
const isAre = (count: number) => (count === 1 ? 'is' : 'are');

const FOOTER: Record<Locale, Pick<AdaptiveReviewCopy, 'footer' | 'unsubscribe'>> = {
  vi: {
    footer:
      'Bạn nhận email này vì đã chọn nhận nhắc ôn tập sau buổi học cá nhân hóa. Mỗi tuần tối đa hai email.',
    unsubscribe: 'Hủy nhận nhắc ôn tập',
  },
  en: {
    footer:
      'You get this email because you asked for a review reminder after a personalized session. At most two emails a week.',
    unsubscribe: 'Unsubscribe from review reminders',
  },
};

export const ADAPTIVE_REVIEW_COPY: Record<Touch, Record<Locale, AdaptiveReviewCopy>> = {
  d2: {
    vi: {
      ...FOOTER.vi,
      subject: (title, due) =>
        due > 0 ? `Ôn lại ${due} khái niệm chưa vững trong “${title}”` : `Ôn lại “${title}”`,
      intro: (title, due) =>
        due > 0
          ? `Hai ngày trước bạn đã học “${title}” với lộ trình cá nhân hóa và còn ${due} khái niệm chưa vững.`
          : `Hai ngày trước bạn đã học “${title}” với lộ trình cá nhân hóa.`,
      why: 'Ôn lại lúc này giúp bạn nhớ lâu hơn. Rinkuzu sẽ chọn bài tập tiếp theo cho đúng những khái niệm đó.',
      button: (due) => (due > 0 ? `Ôn lại ${due} khái niệm` : 'Học tiếp'),
    },
    en: {
      ...FOOTER.en,
      subject: (title, due) =>
        due > 0 ? `Review the ${concepts(due)} to firm up in “${title}”` : `Review “${title}”`,
      intro: (title, due) =>
        due > 0
          ? `Two days ago you studied “${title}” in personalized learning, and ${concepts(due)} still ${isAre(due)} shaky.`
          : `Two days ago you studied “${title}” in personalized learning.`,
      why: 'Reviewing now helps it stick. Rinkuzu picks your next exercises for exactly those concepts.',
      button: (due) => (due > 0 ? `Review ${concepts(due)}` : 'Keep learning'),
    },
  },
  d5: {
    vi: {
      ...FOOTER.vi,
      subject: (title, due) =>
        due > 0
          ? `${due} khái niệm trong “${title}” đã đến lúc ôn lại`
          : `Đến lúc ôn lại “${title}”`,
      intro: (title, due) =>
        due > 0
          ? `${due} khái niệm bạn chưa vững trong “${title}” đã đến lúc ôn lại.`
          : `“${title}” đã đến lúc ôn lại.`,
      why: 'Ôn lại sau vài ngày là lúc giúp bạn nhớ lâu nhất. Đây là email nhắc cuối cùng cho tài liệu này.',
      button: (due) => (due > 0 ? `Ôn lại ${due} khái niệm` : 'Học tiếp'),
    },
    en: {
      ...FOOTER.en,
      subject: (title, due) =>
        due > 0
          ? `${concepts(due)} in “${title}” ${isAre(due)} due for review`
          : `“${title}” is due for review`,
      intro: (title, due) =>
        due > 0
          ? `The ${concepts(due)} you were unsure of in “${title}” ${isAre(due)} due for review.`
          : `“${title}” is due for review.`,
      why: 'A review a few days later is what makes it stick. This is the last reminder for this document.',
      button: (due) => (due > 0 ? `Review ${concepts(due)}` : 'Keep learning'),
    },
  },
};

/** The email names the document by its file name; one whose job is gone reads generically. */
export function adaptiveDocumentTitle(locale: Locale, title: string | null): string {
  const trimmed = title?.trim();
  if (trimmed) return trimmed.slice(0, 120);
  return locale === 'en' ? 'your document' : 'tài liệu của bạn';
}
