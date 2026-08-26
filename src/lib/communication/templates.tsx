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
  children: ReactNode;
  footer?: ReactNode;
}

function MailFrame({ preview, children, footer }: MailFrameProps) {
  return (
    <Html lang="vi">
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
  subject: string;
  body: string;
  declineUrl: string;
  optOutUrl: string;
  reminder?: boolean;
}): Promise<RenderedCommunicationMail> {
  return renderElement(
    <MailFrame
      preview={input.subject}
      footer={
        <Text style={{ color: '#736b63', fontSize: '12px', lineHeight: '18px' }}>
          Việc trả lời hoàn toàn tự nguyện. Bạn có thể{' '}
          <Link href={input.declineUrl}>từ chối lời mời này</Link> hoặc{' '}
          <Link href={input.optOutUrl}>không nhận lời mời phản hồi trong tương lai</Link>.
        </Text>
      }
    >
      <Heading style={{ color: '#251b15', fontSize: '24px' }}>
        {input.reminder ? 'Nhắc lại lời mời chia sẻ trải nghiệm' : 'RinKuzu muốn lắng nghe bạn'}
      </Heading>
      {input.body.split(/\n{2,}/u).map((paragraph) => (
        <Text key={paragraph} style={{ color: '#403832', fontSize: '15px', lineHeight: '24px' }}>
          {paragraph}
        </Text>
      ))}
      <Text style={{ color: '#403832', fontSize: '14px', lineHeight: '22px' }}>
        Bạn chỉ cần Reply email này như bình thường.
      </Text>
    </MailFrame>,
  );
}

export async function renderFeedbackReply(input: {
  subject: string;
  body: string;
  declineUrl: string;
  optOutUrl: string;
}): Promise<RenderedCommunicationMail> {
  return renderElement(
    <MailFrame
      preview={input.subject}
      footer={
        <Text style={{ color: '#736b63', fontSize: '12px', lineHeight: '18px' }}>
          Bạn có thể <Link href={input.declineUrl}>kết thúc cuộc trao đổi</Link> hoặc{' '}
          <Link href={input.optOutUrl}>không nhận lời mời phản hồi trong tương lai</Link>.
        </Text>
      }
    >
      <Heading style={{ color: '#251b15', fontSize: '22px' }}>Phản hồi từ RinKuzu</Heading>
      {input.body.split(/\n{2,}/u).map((paragraph) => (
        <Text key={paragraph} style={{ color: '#403832', fontSize: '15px', lineHeight: '24px' }}>
          {paragraph}
        </Text>
      ))}
      <Text style={{ color: '#736b63', fontSize: '12px' }}>
        Reply email này để tiếp tục cuộc trao đổi.
      </Text>
    </MailFrame>,
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
