import { AdminCampaignDetailPage } from '@/features/communications/components/AdminCampaignDetailPage';

export default async function AdminCampaignDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminCampaignDetailPage id={id} />;
}
