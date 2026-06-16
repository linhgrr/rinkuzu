// /src/app/[locale]/(app)/draft/[id]/edit/page.tsx
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';
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

  // The S3 presign and the category lookup are independent — run them together.
  // PDF preview signing uses the S3 store shared with FastAPI; category metadata
  // still lives in the Next-owned Mongo collection.
  const [pdfUrl, initialCategory] = await Promise.all([
    draft.pdf?.s3_key
      ? getSignedPDFUrl(draft.pdf.s3_key).catch((error) => {
          console.error('Failed to refresh signed URL:', error);
          return undefined;
        })
      : Promise.resolve(undefined),
    draft.category_id
      ? connectDB()
          .then(() => Category.findById(draft.category_id).lean())
          .then((category) => (category ? JSON.parse(JSON.stringify(category)) : null))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const initialDraft = {
    _id: draft.draft_id,
    title: draft.title,
    categoryId: draft.category_id ?? undefined,
    questions: draft.questions,
    status: draft.status,
    createdAt: draft.created_at,
    expiresAt: draft.expires_at,
    pdfData: {
      fileName: draft.pdf?.file_name ?? 'quiz-source.pdf',
      pdfUrl,
    },
  };

  return (
    <DraftEditClient
      initialDraft={initialDraft}
      initialCategory={initialCategory}
      locale={locale}
    />
  );
}
