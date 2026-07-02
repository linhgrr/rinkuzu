// /src/app/[locale]/(app)/draft/[id]/edit/page.tsx
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import DraftEditClient from './DraftEditClient';
import { getSignedPDFUrl } from '@/lib/s3';
import { fetchQuizDraftServer } from '@/lib/quiz/draftServer';
import { AsyncRouteParams } from '@/types/next-route';

type Props = AsyncRouteParams<{ id: string; locale: string }>;

export default async function DraftEditPage({ params }: Props) {
  const [{ id, locale }, session] = await Promise.all([params, getServerSession(authOptions)]);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect(`/${locale}/login`);
  }

  const draft = await fetchQuizDraftServer(id, userId);
  if (!draft) {
    notFound();
  }

  const pdfUrl = await (draft.pdf?.s3Key
    ? getSignedPDFUrl(draft.pdf.s3Key).catch((error) => {
        console.error('Failed to refresh signed URL:', error);
        return undefined;
      })
    : Promise.resolve(undefined));

  return <DraftEditClient initialDraft={draft} locale={locale} pdfUrl={pdfUrl} />;
}
