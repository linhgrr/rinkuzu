// /src/app/[locale]/draft/[id]/edit/page.tsx
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import Category from '@/models/Category';
import DraftEditClient from './DraftEditClient';
import { getSignedPDFUrl } from '@/lib/s3';
import { AsyncRouteParams } from '@/types/next-route';

type Props = AsyncRouteParams<{ id: string; locale: string }>;
type DraftQuestion = {
  question: string;
  options: string[];
  correctIndex?: number;
  correctIndexes?: number[];
  type: 'single' | 'multiple';
  explanation?: string;
};

type DraftQuizLean = {
  _id: string;
  userId: string;
  title: string;
  prompt?: string;
  categoryId?: string;
  pdfData: {
    fileName: string;
    fileSize: number;
    totalPages: number;
    pdfKey: string;
    pdfUrl?: string;
  };
  chunks: {
    total: number;
    processed: number;
    current: number;
    chunkDetails: Array<{
      index: number;
      startPage: number;
      endPage: number;
      status: 'pending' | 'processing' | 'done' | 'error';
      error?: string;
      lockedAt?: Date;
      lockedBy?: string;
    }>;
  };
  questions: DraftQuestion[];
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export default async function DraftEditPage({ params }: Props) {
  const [{ id, locale }, session] = await Promise.all([params, getServerSession(authOptions)]);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect(`/${locale}/login`);
  }

  await connectDB();

  const draft = (await DraftQuiz.findOne({
    _id: id,
    userId,
  }).lean()) as DraftQuizLean | null;

  if (!draft) {
    notFound();
  }

  // Ensure plain objects for Client Component
  const sanitizedDraft = JSON.parse(JSON.stringify(draft));

  // Refresh signed URL if PDF exists
  if (sanitizedDraft.pdfData?.pdfKey) {
    try {
      sanitizedDraft.pdfData.pdfUrl = await getSignedPDFUrl(sanitizedDraft.pdfData.pdfKey);
    } catch (error) {
      console.error('Failed to refresh signed URL:', error);
    }
  }

  // Fetch category if it exists
  let initialCategory = null;
  if (sanitizedDraft.categoryId) {
    const category = await Category.findById(sanitizedDraft.categoryId).lean();
    if (category) {
      initialCategory = JSON.parse(JSON.stringify(category));
    }
  }

  return (
    <DraftEditClient
      initialDraft={sanitizedDraft}
      initialCategory={initialCategory}
      locale={locale}
    />
  );
}
