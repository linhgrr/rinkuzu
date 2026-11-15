import 'server-only';

import { Button, Section, Text } from '@react-email/components';
import {
  MAIL_BODY_TEXT,
  MAIL_BUTTON,
  MAIL_FOOTER_TEXT,
  MailFrame,
  renderElement,
  type RenderedCommunicationMail,
  type ReviewReminderLocale,
} from './templates';

interface OutageNotifyCopy {
  subject: string;
  body: string;
  button: string;
  footer: string;
}

/**
 * Copy for the one-off "Rinkuzu is back" email (RIN-1653, spec RIN-1643 AC 5).
 * Plain on purpose: no cause, no provider, nothing about billing.
 */
const OUTAGE_NOTIFY_COPY: Record<ReviewReminderLocale, OutageNotifyCopy> = {
  vi: {
    subject: 'Rinkuzu đã hoạt động trở lại',
    body: 'Bạn đã nhờ chúng tôi báo khi Rinkuzu trở lại. Giờ bạn có thể quay lại học tiếp.',
    button: 'Làm bài quiz mẫu',
    footer:
      'Bạn nhận email này một lần vì đã để lại địa chỉ trên trang thông báo của Rinkuzu. Chúng tôi sẽ xoá địa chỉ trong vòng 30 ngày.',
  },
  en: {
    subject: 'Rinkuzu is back',
    body: 'You asked us to tell you when Rinkuzu was back. It is.',
    button: 'Try the starter quiz',
    footer:
      "You get this once because you left your address on Rinkuzu's status page. We delete it within 30 days.",
  },
};

export async function renderOutageNotify(input: {
  locale: ReviewReminderLocale;
  ctaUrl: string;
}): Promise<RenderedCommunicationMail & { subject: string }> {
  const copy = OUTAGE_NOTIFY_COPY[input.locale];
  const mail = await renderElement(
    <MailFrame
      lang={input.locale}
      preview={copy.body}
      footer={<Text style={MAIL_FOOTER_TEXT}>{copy.footer}</Text>}
    >
      <Text style={MAIL_BODY_TEXT}>{copy.body}</Text>
      <Section style={{ margin: '22px 0' }}>
        <Button href={input.ctaUrl} style={MAIL_BUTTON}>
          {copy.button}
        </Button>
      </Section>
    </MailFrame>,
  );
  return { ...mail, subject: copy.subject };
}
