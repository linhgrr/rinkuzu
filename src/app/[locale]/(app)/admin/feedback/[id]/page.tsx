import { AdminFeedbackConversationPage } from '@/features/communications/components/AdminFeedbackConversationPage';

export default async function AdminFeedbackDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminFeedbackConversationPage id={id} />;
}
