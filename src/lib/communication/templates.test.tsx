import { describe, expect, it } from 'vitest';
import { renderCampaign, renderFeedbackInvitation } from './templates';

describe('communication email templates', () => {
  it('renders voluntary feedback controls and reply instructions', async () => {
    const mail = await renderFeedbackInvitation({
      subject: 'Share your experience',
      body: 'We would value your honest feedback.',
      declineUrl: 'https://rinkuzu.app/feedback/preferences?action=decline',
      optOutUrl: 'https://rinkuzu.app/feedback/preferences?action=opt_out',
    });
    expect(mail.html).toContain('Reply email');
    expect(mail.html).toContain('action=opt_out');
    expect(mail.text).toContain('hoàn toàn tự nguyện');
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
