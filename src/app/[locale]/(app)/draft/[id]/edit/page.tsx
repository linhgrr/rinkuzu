import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DraftEditPage } from '@/features/quiz/components/draft/DraftEditPage';
import { getSignedPDFUrl } from '@/lib/s3';
import { fetchQuizDraftServer } from '@/lib/quiz/draftServer';
import type { AsyncRouteParams } from '@/types/next-route';

type Props = AsyncRouteParams<{ id: string; locale: string }>;

export default async function DraftEditRoutePage({ params }: Props) {
  const [{ id, locale }, session] = await Promise.all([params, getServerSession(authOptions)]);
  const userId = session?.user?.id;
  if (!userId) {
    return redirect({ href: '/login', locale });
  }

  const draft = await fetchQuizDraftServer(id, userId);
  if (!draft) {
    notFound();
  }

  const pdfUrl = draft.pdf?.s3Key
    ? await getSignedPDFUrl(draft.pdf.s3Key).catch((error) => {
        console.error('Failed to refresh signed URL:', error);
        return undefined;
      })
    : undefined;

  return <DraftEditPage initialDraft={draft} {...(pdfUrl !== undefined ? { pdfUrl } : {})} />;
}
