// /src/app/api/draft/create/route.ts
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import { BUCKET_NAME, deletePDF, OBJECT_STORAGE_PUBLIC_BASE_URL } from '@/lib/s3';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const EXPIRY_HOURS = 48;

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const body = await request.json();
    const {
      title,
      categoryId,
      category,
      s3Key,
      fileName,
      fileSize: rawFileSize,
      totalPages: rawTotalPages,
      prompt,
    } = body;

    if (!title?.trim() || !fileName || !s3Key) {
      return apiErr('validation_error', 'Title, filename, and s3Key are required', 400);
    }

    let pdfKey = '';
    let pdfUrl = '';
    let fileSize = 0;
    let totalPages: number;

    if (typeof s3Key === 'string' && s3Key.trim()) {
      pdfKey = s3Key.trim().replace(/^\/+/, '');
      const expectedPrefix = `uploads/quiz_extract/${userId}/`;
      if (!pdfKey.startsWith(expectedPrefix)) {
        return apiErr('forbidden', 'Invalid s3Key for current user', 403);
      }

      pdfUrl = `${OBJECT_STORAGE_PUBLIC_BASE_URL}/${BUCKET_NAME}/${pdfKey}`;

      const parsedFileSize = Number(rawFileSize);
      fileSize = Number.isFinite(parsedFileSize) && parsedFileSize > 0 ? parsedFileSize : 0;
      if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        return apiErr('validation_error', 'Invalid file size (max 50MB)', 400);
      }

      const parsedTotalPages = Number(rawTotalPages);
      totalPages =
        Number.isFinite(parsedTotalPages) && parsedTotalPages > 0
          ? Math.floor(parsedTotalPages)
          : 1;
    } else {
      return apiErr('validation_error', 'Invalid s3Key', 400);
    }

    const chunkDetails = [
      {
        index: 0,
        startPage: 1,
        endPage: totalPages,
        status: 'pending' as const,
      },
    ];

    await connectDB();

    // Create draft
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

    let draft;
    const trimmedPrompt = prompt?.trim();

    try {
      draft = await DraftQuiz.create({
        userId,
        title: title.trim(),
        categoryId: categoryId || category || undefined,
        prompt: trimmedPrompt || undefined,
        pdfData: {
          fileName,
          fileSize,
          totalPages,
          pdfKey, // S3 key for fetching PDF
          pdfUrl, // Signed URL for PDF viewing
        },
        chunks: {
          total: chunkDetails.length,
          processed: 0,
          current: 0,
          chunkDetails,
        },
        questions: [],
        status: 'processing',
        expiresAt,
      });
    } catch (dbError) {
      // Rollback S3 upload
      logger.error({ dbError }, 'Draft creation failed, rolling back S3');
      try {
        await deletePDF(pdfKey);
      } catch (s3Error) {
        logger.error({ s3Error }, 'S3 rollback failed');
      }
      throw dbError;
    }

    return apiOk(
      {
        draftId: draft._id.toString(),
        title: draft.title,
        chunks: {
          total: chunkDetails.length,
          chunkDetails: chunkDetails.map((c) => ({
            index: c.index,
            startPage: c.startPage,
            endPage: c.endPage,
            status: c.status,
          })),
        },
        totalPages,
        expiresAt: draft.expiresAt,
      },
      201,
    );
  } catch (error) {
    logger.error({ error }, 'Draft create error');
    return apiErr('internal_error', 'Failed to create draft', 500);
  }
});
