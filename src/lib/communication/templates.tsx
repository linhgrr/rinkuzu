import 'server-only';

import { render } from '@react-email/render';
import {
  Body,
  Button,
  Container,
  Hr,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import type { CampaignBlockInput } from '@/dtos/communication';

export interface RenderedCommunicationMail {
  html: string;
  text: string;
}

interface MailFrameProps {
  preview: string;
  lang?: string;
  children: ReactNode;
  footer?: ReactNode;
}

function MailFrame({ preview, children, footer, lang = 'vi' }: MailFrameProps) {
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f6f4ef', fontFamily: 'Arial, sans-serif', margin: 0 }}>
        <Container
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e6e0d6',
            borderRadius: '14px',
            margin: '32px auto',
            maxWidth: '620px',
            padding: '32px',
          }}
        >
          <Text style={{ color: '#7a4b2a', fontSize: '20px', fontWeight: 700, marginTop: 0 }}>
            RinKuzu
          </Text>
          {children}
          <Hr style={{ borderColor: '#eee8df', margin: '28px 0 18px' }} />
          {footer ?? (
            <Text style={{ color: '#736b63', fontSize: '12px', lineHeight: '18px' }}>
              Đây là email tự động từ RinKuzu. Vui lòng không gửi thông tin nhạy cảm qua email.
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const CONVERSATION_TEXT = { color: '#222222', fontSize: '15px', lineHeight: '24px' } as const;
const CONVERSATION_FOOTNOTE = { color: '#666666', fontSize: '13px', lineHeight: '20px' } as const;

/**
 * Feedback outreach is a one-to-one conversation, not a campaign, and it is the
 * only mail we ask people to reply to.
 *
 * Gmail classifies at delivery time per recipient, weighing HTML structure
 * heavily while a sending domain still has no history. A bordered, coloured
 * card with a wordmark, a rule and a display heading is the shape of a
 * marketing template and reads as Promotions. This frame keeps the markup close
 * to what a person would actually send: no background, no card, no heading, no
 * preheader, and a single link.
 */
function ConversationMailFrame({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <Html lang="vi">
      <Head />
      <Body style={{ fontFamily: 'Arial, Helvetica, sans-serif', margin: 0 }}>
        <Container style={{ margin: '0 auto', maxWidth: '600px', padding: '16px' }}>
          {children}
          {footer}
        </Container>
      </Body>
    </Html>
  );
}

/**
 * One link, not two. Both choices live on the preferences page, so the footer
 * stops looking like a newsletter's unsubscribe row while the user keeps the
 * same control.
 */
function FeedbackPreferencesNote({ url, lead }: { url: string; lead: string }) {
  return (
    <Text style={CONVERSATION_FOOTNOTE}>
      {lead} <Link href={url}>quản lý lời mời phản hồi tại đây</Link>.
    </Text>
  );
}

async function renderElement(element: React.ReactElement): Promise<RenderedCommunicationMail> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

export async function renderSupportNotification(input: {
  subject: string;
  messagePreview: string;
  ticketUrl: string;
}): Promise<RenderedCommunicationMail> {
  return renderElement(
    <MailFrame preview={`Có phản hồi mới: ${input.subject}`}>
      <Heading style={{ color: '#251b15', fontSize: '24px' }}>
        Ticket hỗ trợ có phản hồi mới
      </Heading>
      <Text style={{ color: '#403832', fontSize: '15px', lineHeight: '24px' }}>
        {input.messagePreview}
      </Text>
      <Button
        href={input.ticketUrl}
        style={{
          backgroundColor: '#9a5c32',
          borderRadius: '8px',
          color: '#fff',
          padding: '12px 20px',
        }}
      >
        Mở cuộc trao đổi
      </Button>
      <Text style={{ color: '#736b63', fontSize: '12px', lineHeight: '18px' }}>
        Hãy trả lời trong RinKuzu. Reply email này không được đồng bộ vào ticket.
      </Text>
    </MailFrame>,
  );
}

export async function renderFeedbackInvitation(input: {
  body: string;
  preferencesUrl: string;
  reminder?: boolean;
}): Promise<RenderedCommunicationMail> {
  return renderElement(
    <ConversationMailFrame
      footer={
        <FeedbackPreferencesNote
          url={input.preferencesUrl}
          lead="Việc trả lời hoàn toàn tự nguyện. Nếu không tiện, bạn có thể"
        />
      }
    >
      {input.reminder ? (
        <Text style={CONVERSATION_TEXT}>
          Mình xin phép nhắc lại lời mời chia sẻ trải nghiệm trước đó.
        </Text>
      ) : null}
      {input.body.split(/\n{2,}/u).map((paragraph) => (
        <Text key={paragraph} style={CONVERSATION_TEXT}>
          {paragraph}
        </Text>
      ))}
      <Text style={CONVERSATION_TEXT}>Bạn chỉ cần Reply email này như bình thường.</Text>
    </ConversationMailFrame>,
  );
}

export async function renderFeedbackReply(input: {
  body: string;
  preferencesUrl: string;
}): Promise<RenderedCommunicationMail> {
  return renderElement(
    <ConversationMailFrame
      footer={<FeedbackPreferencesNote url={input.preferencesUrl} lead="Bạn có thể" />}
    >
      {input.body.split(/\n{2,}/u).map((paragraph) => (
        <Text key={paragraph} style={CONVERSATION_TEXT}>
          {paragraph}
        </Text>
      ))}
      <Text style={CONVERSATION_TEXT}>Reply email này để tiếp tục cuộc trao đổi.</Text>
    </ConversationMailFrame>,
  );
}

function campaignBlock(block: CampaignBlockInput): ReactNode {
  switch (block.type) {
    case 'heading':
      return (
        <Heading key={block.id} as={block.level === 1 ? 'h1' : block.level === 3 ? 'h3' : 'h2'}>
          {block.text}
        </Heading>
      );
    case 'paragraph':
      return (
        <Text key={block.id} style={{ fontSize: '15px', lineHeight: '24px' }}>
          {block.text}
        </Text>
      );
    case 'image':
      return (
        <Img
          key={block.id}
          src={block.url}
          alt={block.label}
          style={{ borderRadius: '10px', maxWidth: '100%' }}
        />
      );
    case 'button':
      return (
        <Section key={block.id} style={{ margin: '22px 0' }}>
          <Button
            href={block.url}
            style={{
              backgroundColor: '#9a5c32',
              borderRadius: '8px',
              color: '#fff',
              padding: '12px 20px',
            }}
          >
            {block.label}
          </Button>
        </Section>
      );
    case 'divider':
      return <Hr key={block.id} style={{ borderColor: '#eee8df', margin: '24px 0' }} />;
    case 'spacer':
      return <Section key={block.id} style={{ height: `${block.height}px` }} />;
  }
}

export async function renderCampaign(input: {
  subject: string;
  previewText?: string;
  blocks: CampaignBlockInput[];
  preferenceUrl: string;
}): Promise<RenderedCommunicationMail> {
  return renderElement(
    <MailFrame
      preview={input.previewText ?? input.subject}
      footer={
        <Text style={{ color: '#736b63', fontSize: '12px', lineHeight: '18px' }}>
          Email quảng cáo từ RinKuzu, Việt Nam · support@rinkuzu.app · rinkuzu.app. Bạn nhận được
          thư vì đã đăng ký chủ đề này.{' '}
          <Link href={input.preferenceUrl}>Hủy đăng ký hoặc quản lý lựa chọn email</Link>.
        </Text>
      }
    >
      {input.blocks.map(campaignBlock)}
    </MailFrame>,
  );
}

export type ReviewReminderLocale = 'vi' | 'en';

interface ReviewReminderCopy {
  subject: (title: string, missed: number) => string;
  intro: (title: string, missed: number) => string;
  why: string;
  button: (missed: number) => string;
  footer: string;
  unsubscribe: string;
}

/**
 * Copy for the 2-day review email (RIN-915). Product term: personalized /
 * cá nhân hóa, never adaptive. The email never carries answers.
 */
const REVIEW_REMINDER_COPY: Record<ReviewReminderLocale, ReviewReminderCopy> = {
  vi: {
    subject: (title, missed) =>
      missed > 0 ? `Ôn lại ${missed} câu chưa đúng trong “${title}”` : `Ôn lại “${title}”`,
    intro: (title, missed) =>
      missed > 0
        ? `Hai ngày trước bạn đã làm bài “${title}” và còn ${missed} câu chưa đúng.`
        : `Hai ngày trước bạn đã làm bài “${title}”.`,
    why: 'Ôn lại lúc này giúp bạn nhớ lâu hơn. Rinkuzu sẽ đưa bạn qua những câu đó trong một lượt ôn tập cá nhân hóa.',
    button: (missed) => (missed > 0 ? `Ôn lại ${missed} câu` : 'Ôn lại bài'),
    footer:
      'Bạn nhận email này vì đã chọn nhận nhắc ôn tập trên trang kết quả. Mỗi tuần tối đa một email.',
    unsubscribe: 'Hủy nhận nhắc ôn tập',
  },
  en: {
    subject: (title, missed) =>
      missed > 0
        ? `Review the ${missed} ${missed === 1 ? 'question' : 'questions'} you missed in “${title}”`
        : `Review “${title}”`,
    intro: (title, missed) =>
      missed > 0
        ? `Two days ago you took “${title}” and missed ${missed} ${missed === 1 ? 'question' : 'questions'}.`
        : `Two days ago you took “${title}”.`,
    why: 'Reviewing now helps it stick. Rinkuzu will take you through those questions in a personalized review.',
    button: (missed) =>
      missed > 0
        ? `Review ${missed} ${missed === 1 ? 'question' : 'questions'}`
        : 'Review the quiz',
    footer:
      'You get this email because you asked for a review reminder on your results page. At most one email a week.',
    unsubscribe: 'Unsubscribe from review reminders',
  },
};

export async function renderReviewReminder(input: {
  locale: ReviewReminderLocale;
  quizTitle: string;
  missedCount: number;
  retryUrl: string;
  unsubscribeUrl: string;
}): Promise<RenderedCommunicationMail & { subject: string }> {
  const copy = REVIEW_REMINDER_COPY[input.locale];
  const subject = copy.subject(input.quizTitle, input.missedCount).slice(0, 200);
  const mail = await renderElement(
    <MailFrame
      lang={input.locale}
      preview={copy.intro(input.quizTitle, input.missedCount)}
      footer={
        <Text style={{ color: '#736b63', fontSize: '12px', lineHeight: '18px' }}>
          {copy.footer} <Link href={input.unsubscribeUrl}>{copy.unsubscribe}</Link>.
        </Text>
      }
    >
      <Text style={{ color: '#403832', fontSize: '15px', lineHeight: '24px' }}>
        {copy.intro(input.quizTitle, input.missedCount)}
      </Text>
      <Text style={{ color: '#403832', fontSize: '15px', lineHeight: '24px' }}>{copy.why}</Text>
      <Section style={{ margin: '22px 0' }}>
        <Button
          href={input.retryUrl}
          style={{
            backgroundColor: '#9a5c32',
            borderRadius: '8px',
            color: '#fff',
            padding: '12px 20px',
          }}
        >
          {copy.button(input.missedCount)}
        </Button>
      </Section>
    </MailFrame>,
  );
  return { ...mail, subject };
}
