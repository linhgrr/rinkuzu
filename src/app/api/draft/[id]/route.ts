// /src/app/api/draft/[id]/route.ts
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import { deletePDF } from '@/lib/s3';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

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

export const GET = withAuth<{ id: string }>(async (_request, { params, userId }) => {
  try {
    const { id } = params;

    await connectDB();

    const draft = (await DraftQuiz.findOne({
      _id: id,
      userId,
    }).lean()) as DraftQuizLean | null;

    if (!draft) {
      return apiErr('not_found', 'Draft not found', 404);
    }

    // Refresh signed URL if PDF exists
    if (draft.pdfData?.pdfKey) {
      try {
        const { getSignedPDFUrl } = await import('@/lib/s3');
        draft.pdfData.pdfUrl = await getSignedPDFUrl(draft.pdfData.pdfKey);
      } catch (error) {
        logger.error({ error }, 'Failed to refresh signed URL');
      }
    }

    return apiOk({ draft });
  } catch (error) {
    logger.error({ error }, 'Get draft error');
    return apiErr('internal_error', 'Failed to get draft', 500);
  }
});

export const DELETE = withAuth<{ id: string }>(async (_request, { params, userId }) => {
  try {
    const { id } = params;

    await connectDB();

    // Find draft first to get pdfKey
    const draft = await DraftQuiz.findOne({
      _id: id,
      userId,
    });

    if (!draft) {
      return apiErr('not_found', 'Draft not found', 404);
    }

    // Delete from MongoDB
    await DraftQuiz.deleteOne({ _id: id });

    // Cleanup S3 (best effort, don't fail if this fails)
    if (draft.pdfData?.pdfKey) {
      try {
        await deletePDF(draft.pdfData.pdfKey);
        console.warn('Deleted PDF from S3:', draft.pdfData.pdfKey);
      } catch (s3Error) {
        logger.error({ s3Error }, 'Failed to delete PDF from S3');
        // Don't fail the request, S3 cleanup is best-effort
      }
    }

    return apiOk(null);
  } catch (error) {
    logger.error({ error }, 'Delete draft error');
    return apiErr('internal_error', 'Failed to delete draft', 500);
  }
});
