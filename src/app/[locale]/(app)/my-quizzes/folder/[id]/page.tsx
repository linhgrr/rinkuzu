import { FolderDetail } from '@/features/folders/components/FolderDetail';
import type { AsyncRouteParams } from '@/types/next-route';

export default async function FolderDetailPage({
  params,
}: AsyncRouteParams<{ id: string; locale: string }>) {
  const { id } = await params;
  return <FolderDetail folderId={id} />;
}
