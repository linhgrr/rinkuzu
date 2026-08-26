import { SupportConversationPage } from '@/features/communications/components/SupportConversationPage';

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  return <SupportConversationPage ticketId={ticketId} />;
}
