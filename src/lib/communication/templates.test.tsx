import { describe, expect, it } from 'vitest';
import {
  renderActivationNudge,
  renderCampaign,
  renderFeedbackInvitation,
  renderReviewReminder,
} from './templates';

describe('activation nudge email (RIN-999)', () => {
  const ctaUrl =
    'https://www.rinkuzu.app/en/quiz/starter?entry=activation_email&utm_source=email&utm_campaign=activation_nudge';
  const unsubscribeUrl = 'https://www.rinkuzu.app/en/unsubscribe?t=token';

  it.each([
    ['vi', 'Bài quiz 2 phút của bạn đã sẵn sàng', 'Chào Jamie,'],
    ['en', 'Your 2-minute quiz is ready', 'Hi Jamie,'],
  ] as const)(
    'renders the %s email under 80 words with one CTA',
    async (locale, subject, hello) => {
      const mail = await renderActivationNudge({
        locale,
        firstName: 'Jamie',
        ctaUrl,
        unsubscribeUrl,
      });
      expect(mail.subject).toBe(subject);
      expect(mail.html).toContain(`lang="${locale}"`);
      expect(mail.html).toContain(ctaUrl.replaceAll('&', '&amp;'));
      expect(mail.html).toContain(unsubscribeUrl);
      expect(mail.text).toContain(hello);
      expect(`${mail.subject}
${mail.text}`).not.toMatch(/adaptive|thích ứng/iu);
      expect(mail.text).toMatch(locale === 'vi' ? /cá nhân hóa/u : /personalized/u);
      const words = mail.text
        .replace(/https?:\/\/\S+|\[[^\]]*\]/gu, ' ')
        .split(/\s+/u)
        .filter((word) => /[\p{L}\d]/u.test(word));
      expect(words.length).toBeLessThan(80);
      expect(mail.html.match(/<a /gu)).toHaveLength(2);
    },
  );

  it('greets without a name when there is none', async () => {
    const mail = await renderActivationNudge({
      locale: 'en',
      firstName: null,
      ctaUrl,
      unsubscribeUrl,
    });
    expect(mail.text).toContain('Hi there,');
  });
});

describe('review reminder email (RIN-915)', () => {
  const retryUrl =
    'https://www.rinkuzu.app/vi/quiz/cell-biology?retryOf=6a8ed209f04328ac17443d91&utm_source=email&utm_campaign=w1-review';
  const unsubscribeUrl = 'https://www.rinkuzu.app/unsubscribe?t=token';

  it.each(['vi', 'en'] as const)('renders the %s email with both links', async (locale) => {
    const mail = await renderReviewReminder({
      locale,
      quizTitle: 'Cell biology',
      missedCount: 3,
      retryUrl,
      unsubscribeUrl,
    });
    expect(mail.html).toContain(retryUrl.replaceAll('&', '&amp;'));
    expect(mail.html).toContain(unsubscribeUrl);
    expect(mail.html).toContain(`lang="${locale}"`);
    expect(`${mail.subject}\n${mail.text}`).not.toMatch(/adaptive|thích ứng/iu);
    expect(mail.subject).toBe(
      locale === 'vi'
        ? 'Ôn lại 3 câu chưa đúng trong “Cell biology”'
        : 'Review the 3 questions you missed in “Cell biology”',
    );
    expect(mail.text).toContain(
      locale === 'vi'
        ? 'Hai ngày trước bạn đã làm bài “Cell biology” và còn 3 câu chưa đúng.'
        : 'Two days ago you took “Cell biology” and missed 3 questions.',
    );
    expect(mail.text).toContain(`${unsubscribeUrl}`);
  });

  it('uses the product term personalized / cá nhân hóa', async () => {
    const input = { quizTitle: 'Biology', missedCount: 1, retryUrl, unsubscribeUrl };
    const vietnamese = await renderReviewReminder({ ...input, locale: 'vi' });
    const english = await renderReviewReminder({ ...input, locale: 'en' });
    expect(vietnamese.text).toContain('cá nhân hóa');
    expect(english.text).toContain('personalized');
    expect(english.subject).toBe('Review the 1 question you missed in “Biology”');
  });
});

describe('day-5 review email (RIN-1304)', () => {
  const retryUrl =
    'https://www.rinkuzu.app/en/quiz/cell-biology?retryOf=6a8ed209f04328ac17443d91&utm_source=email&utm_campaign=w1-review-d5';
  const unsubscribeUrl = 'https://www.rinkuzu.app/en/unsubscribe?t=token';

  it.each([
    ['vi', '3 câu trong “Cell biology” đã đến lúc ôn lại', '3 câu bạn chưa đúng trong bài'],
    ['en', '3 questions in “Cell biology” are due for review', 'The 3 questions you missed in'],
  ] as const)(
    'renders the %s email: title, count, one retry link',
    async (locale, subject, intro) => {
      const mail = await renderReviewReminder({
        touch: 'd5',
        locale,
        quizTitle: 'Cell biology',
        missedCount: 3,
        retryUrl,
        unsubscribeUrl,
      });
      expect(mail.subject).toBe(subject);
      expect(mail.text).toContain(intro);
      expect(mail.html).toContain(`lang="${locale}"`);
      expect(mail.html.split(retryUrl.replaceAll('&', '&amp;')).length - 1).toBe(1);
      expect(mail.html).toContain('utm_campaign=w1-review-d5');
      expect(mail.html).toContain(unsubscribeUrl);
      expect(mail.text).toMatch(/At most two emails a week|Mỗi tuần tối đa hai email/u);
      expect(`${mail.subject}
${mail.text}`).not.toMatch(/adaptive|thích ứng|answer|đáp án/iu);
    },
  );

  it('agrees in number for one question', async () => {
    const mail = await renderReviewReminder({
      touch: 'd5',
      locale: 'en',
      quizTitle: 'Biology',
      missedCount: 1,
      retryUrl,
      unsubscribeUrl,
    });
    expect(mail.subject).toBe('1 question in “Biology” is due for review');
  });
});

describe('communication email templates', () => {
  const preferencesUrl = 'https://rinkuzu.app/feedback/preferences?token=abc';

  it('renders voluntary feedback controls and reply instructions', async () => {
    const mail = await renderFeedbackInvitation({
      body: 'We would value your honest feedback.',
      preferencesUrl,
    });
    expect(mail.html).toContain('Reply email');
    expect(mail.html).toContain(preferencesUrl);
    expect(mail.text).toContain('hoàn toàn tự nguyện');
  });

  it('keeps the invitation shaped like a person-to-person message', async () => {
    const mail = await renderFeedbackInvitation({
      body: 'We would value your honest feedback.',
      preferencesUrl,
    });

    // Gmail leans on HTML structure while a sending domain has no history, so
    // the card chrome, display heading and preheader all stay out of this one.
    expect(mail.html).not.toContain('<h1');
    expect(mail.html).not.toContain('border-radius');
    expect(mail.html).not.toContain('background-color');
    // Exactly one outbound link: the preferences page.
    expect(mail.html.match(/<a\s/gu) ?? []).toHaveLength(1);
    expect(mail.html).not.toContain('<img');
  });

  it('renders only validated campaign blocks with an unsubscribe control', async () => {
    const mail = await renderCampaign({
      subject: 'Update',
      blocks: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          type: 'heading',
          text: 'New feature',
          level: 2,
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          type: 'button',
          label: 'Open RinKuzu',
          url: 'https://rinkuzu.app',
        },
      ],
      preferenceUrl: '{{{RESEND_UNSUBSCRIBE_URL}}}',
    });
    expect(mail.html).toContain('New feature');
    expect(mail.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    expect(mail.text).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    expect(mail.html).not.toContain('<script');
  });
});
