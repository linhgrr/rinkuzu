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

interface PremiumRejectCopy {
  subject: (title: string) => string;
  intro: (title: string) => string;
  noteLabel: string;
  madePublic: string;
  resubmit: string;
  button: string;
  footer: string;
}

/**
 * Copy for the Premium reject email (RIN-1348). The only data is the quiz
 * title and the reviewer's note; no other learner data.
 */
const PREMIUM_REJECT_COPY: Record<ReviewReminderLocale, PremiumRejectCopy> = {
  vi: {
    subject: (title) => `Bài quiz “${title}” chưa được nhận vào Premium`,
    intro: (title) => `Bài quiz “${title}” của bạn chưa được nhận vào Premium.`,
    noteLabel: 'Ghi chú của người duyệt:',
    madePublic: 'Giờ bài quiz đã công khai: ai cũng có thể tìm và làm bài.',
    resubmit:
      'Bạn có thể sửa và gửi lại vào Premium. Trong lúc chờ duyệt, bài quiz sẽ ở chế độ riêng tư.',
    button: 'Sửa bài quiz',
    footer: 'Bạn nhận email này vì đã gửi một bài quiz vào Premium trên Rinkuzu.',
  },
  en: {
    subject: (title) => `Your quiz “${title}” was not accepted into Premium`,
    intro: (title) => `Your quiz “${title}” was not accepted into Premium.`,
    noteLabel: 'Reviewer note:',
    madePublic: 'It is now public: anyone can find and play it.',
    resubmit:
      'You can edit it and submit it to Premium again. While it waits for review, it is private again.',
    button: 'Edit the quiz',
    footer: 'You get this email because you submitted a quiz to Rinkuzu Premium.',
  },
};

export async function renderPremiumReject(input: {
  locale: ReviewReminderLocale;
  quizTitle: string;
  reviewerNote?: string;
  quizMadePublic: boolean;
  editUrl: string;
}): Promise<RenderedCommunicationMail & { subject: string }> {
  const copy = PREMIUM_REJECT_COPY[input.locale];
  const note = input.reviewerNote?.trim();
  const mail = await renderElement(
    <MailFrame
      lang={input.locale}
      preview={copy.intro(input.quizTitle)}
      footer={<Text style={MAIL_FOOTER_TEXT}>{copy.footer}</Text>}
    >
      <Text style={{ ...MAIL_BODY_TEXT, fontWeight: 700 }}>{copy.intro(input.quizTitle)}</Text>
      {note ? (
        <Text style={{ ...MAIL_BODY_TEXT, whiteSpace: 'pre-line' }}>
          {copy.noteLabel} {note}
        </Text>
      ) : null}
      {input.quizMadePublic ? <Text style={MAIL_BODY_TEXT}>{copy.madePublic}</Text> : null}
      <Text style={MAIL_BODY_TEXT}>{copy.resubmit}</Text>
      <Section style={{ margin: '22px 0' }}>
        <Button href={input.editUrl} style={MAIL_BUTTON}>
          {copy.button}
        </Button>
      </Section>
    </MailFrame>,
  );
  return { ...mail, subject: copy.subject(input.quizTitle).slice(0, 200) };
}
