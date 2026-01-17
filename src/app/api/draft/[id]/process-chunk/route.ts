// /src/app/api/draft/[id]/process-chunk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import { PDFDocument } from 'pdf-lib';
import { extractQuestionsFromPdf } from '@/lib/gemini';
import { getPDFBuffer } from '@/lib/s3';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let chunkIndex: number;
    try {
      const body = await request.json();
      chunkIndex = body.chunkIndex;
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid or empty request body' },
        { status: 400 }
      );
    }

    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      return NextResponse.json(
        { error: 'Valid chunkIndex is required' },
        { status: 400 }
      );
    }

    const LOCK_TIMEOUT_MS = 60000; // 60 seconds - if locked longer, consider stale

    // Generate unique request ID
    const requestId = randomUUID();
    const now = new Date();
    const lockExpiry = new Date(now.getTime() - LOCK_TIMEOUT_MS);

    await connectDB();

    // Atomic lock acquisition - only lock if:
    // 1. status is 'pending' or 'error', OR
    // 2. status is 'processing' but lock is stale (older than LOCK_TIMEOUT_MS)
    const lockResult = await DraftQuiz.findOneAndUpdate(
      {
        _id: params.id,
        userId: (session!.user as any).id,
        'chunks.chunkDetails': {
          $elemMatch: {
            index: chunkIndex,
            $or: [
              { status: { $in: ['pending', 'error'] } },
              { status: 'processing', lockedAt: { $lt: lockExpiry } }
            ]
          }
        }
      },
      {
        $set: {
          'chunks.chunkDetails.$.status': 'processing',
          'chunks.chunkDetails.$.lockedAt': now,
          'chunks.chunkDetails.$.lockedBy': requestId,
          'chunks.current': chunkIndex,
        }
      },
      { new: true }
    );

    if (!lockResult) {
      // Could not acquire lock - check why
      const draft = await DraftQuiz.findOne({
        _id: params.id,
        userId: (session!.user as any).id,
      });

      if (!draft) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }

      const chunk = draft.chunks.chunkDetails.find((c: any) => c.index === chunkIndex);

      if (chunk?.status === 'done') {
        return NextResponse.json({
          success: true,
          message: 'Chunk already processed',
          questions: [],
          progress: {
            processed: draft.chunks.processed,
            total: draft.chunks.total,
            isComplete: draft.chunks.processed >= draft.chunks.total,
          },
        });
      }

      // Another request is processing it
      return NextResponse.json({
        success: false,
        error: 'Chunk is being processed by another request',
        retryAfter: 5000,
      }, { status: 409 });
    }

    // We have the lock, use lockResult as draft
    const draft = lockResult;

    // 2. Initial check - is the client already gone?
    if (request.signal.aborted) {
      return NextResponse.json({ error: 'Request aborted' }, { status: 499 });
    }

    if (!draft.pdfData.pdfKey) {
      return NextResponse.json(
        { error: 'PDF not available' },
        { status: 400 }
      );
    }

    const chunkDetail = draft.chunks.chunkDetails.find(
      (c: any) => c.index === chunkIndex
    );

    if (!chunkDetail) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    try {
      // Extract pages for this chunk
      let fullPdfBuffer: Buffer;
      try {
        fullPdfBuffer = await getPDFBuffer(draft.pdfData.pdfKey);
      } catch (s3Error) {
        console.error('Failed to fetch PDF from S3:', s3Error);
        return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 500 });
      }
      const fullPdfDoc = await PDFDocument.load(fullPdfBuffer);

      const chunkPdfDoc = await PDFDocument.create();
      for (let i = chunkDetail.startPage - 1; i < chunkDetail.endPage; i++) {
        if (i < fullPdfDoc.getPageCount()) {
          const [copiedPage] = await chunkPdfDoc.copyPages(fullPdfDoc, [i]);
          chunkPdfDoc.addPage(copiedPage);
        }
      }

      const chunkBuffer = Buffer.from(await chunkPdfDoc.save());

      // 3. Pre-AI check - is the client still there?
      if (request.signal.aborted) {
        throw new Error('AbortError: Request was cancelled by user');
      }

      // 4. Pre-AI check - double check if draft was deleted while we were loading PDF
      const stillExists = await DraftQuiz.exists({ _id: params.id });
      if (!stillExists) {
        throw new Error('Draft was deleted or cancelled');
      }

      // Extract questions using AI
      const extractedQuestions = await extractQuestionsFromPdf(chunkBuffer, 2, request.signal);

      // Remove duplicates with existing questions
      const existingHashes = new Set(
        draft.questions.map((q: any) => hashQuestion(q))
      );

      const newQuestions = extractedQuestions.filter(
        (q: any) => !existingHashes.has(hashQuestion(q))
      );

      // Update draft with new questions
      const updateResult = await DraftQuiz.findOneAndUpdate(
        { _id: params.id, 'chunks.chunkDetails.index': chunkIndex },
        {
          $push: { questions: { $each: newQuestions } },
          $set: { 'chunks.chunkDetails.$.status': 'done' },
          $inc: { 'chunks.processed': 1 },
        },
        { new: true }
      );

      const isComplete = updateResult!.chunks.processed >= updateResult!.chunks.total;

      // If complete, update status
      if (isComplete) {
        await DraftQuiz.updateOne(
          { _id: params.id },
          { $set: { status: 'completed' } }
        );
      }

      return NextResponse.json({
        success: true,
        questions: newQuestions,
        progress: {
          processed: updateResult!.chunks.processed,
          total: updateResult!.chunks.total,
          isComplete,
          totalQuestions: updateResult!.questions.length,
        },
      });

    } catch (extractError: any) {
      // Mark chunk as error
      await DraftQuiz.updateOne(
        { _id: params.id, 'chunks.chunkDetails.index': chunkIndex },
        {
          $set: {
            'chunks.chunkDetails.$.status': 'error',
            'chunks.chunkDetails.$.error': extractError.message,
          },
        }
      );

      return NextResponse.json({
        success: false,
        error: extractError.message,
        progress: {
          processed: draft.chunks.processed,
          total: draft.chunks.total,
          isComplete: false,
        },
      });
    }

  } catch (error) {
    console.error('Process chunk error:', error);
    return NextResponse.json(
      { error: 'Failed to process chunk' },
      { status: 500 }
    );
  }
}

function hashQuestion(q: any): string {
  const normalizedQuestion = q.question?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
  const normalizedOptions = q.options?.map((opt: string) =>
    opt.toLowerCase().trim().replace(/\s+/g, ' ')
  ).join('|') || '';
  return `${normalizedQuestion}:::${normalizedOptions}`;
}
