import { SupportConversationPage } from '@/features/communications/components/SupportConversationPage';

export default async function AdminSupportDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SupportConversationPage ticketId={id} admin />;
}
