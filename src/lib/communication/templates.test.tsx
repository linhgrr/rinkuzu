import { describe, expect, it } from 'vitest';
import { renderCampaign, renderFeedbackInvitation } from './templates';

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
