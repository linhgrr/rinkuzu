import { describe, expect, it } from 'vitest';
import { renderCampaign, renderFeedbackInvitation, renderReviewReminder } from './templates';

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
