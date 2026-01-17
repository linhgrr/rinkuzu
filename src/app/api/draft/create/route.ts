// /src/app/api/draft/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import { PDFDocument } from 'pdf-lib';
import { uploadPDF, generatePDFKey } from '@/lib/s3';

const CHUNK_SIZE = 5; // pages per chunk
const OVERLAP_PAGES = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const EXPIRY_HOURS = 48;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, categoryId, pdfBase64, fileName } = body;

    if (!title?.trim() || !pdfBase64 || !fileName) {
      return NextResponse.json(
        { error: 'Title, PDF data, and filename are required' },
        { status: 400 }
      );
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = pdfBase64.includes(',')
      ? pdfBase64.split(',')[1]
      : pdfBase64;

    // Validate file size
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    // Parse PDF to get page count
    let totalPages: number;
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      totalPages = pdfDoc.getPageCount();
    } catch {
      return NextResponse.json(
        { error: 'Invalid PDF file' },
        { status: 400 }
      );
    }

    // Calculate chunks
    const chunkDetails: Array<{
      index: number;
      startPage: number;
      endPage: number;
      status: 'pending';
    }> = [];

    if (totalPages <= CHUNK_SIZE) {
      // Small PDF - single chunk
      chunkDetails.push({
        index: 0,
        startPage: 1,
        endPage: totalPages,
        status: 'pending',
      });
    } else {
      // Large PDF - multiple chunks with overlap
      let chunkIndex = 0;
      for (let start = 1; start <= totalPages; start += CHUNK_SIZE - OVERLAP_PAGES) {
        const end = Math.min(start + CHUNK_SIZE - 1, totalPages);
        chunkDetails.push({
          index: chunkIndex++,
          startPage: start,
          endPage: end,
          status: 'pending',
        });
        if (end >= totalPages) break;
      }
    }

    await connectDB();

    // Upload PDF to S3 (REQUIRED)
    const userId = (session!.user as any).id;
    const pdfKey = generatePDFKey(userId, fileName);
    let pdfUrl: string;

    try {
      pdfUrl = await uploadPDF(buffer, pdfKey);
      console.log('PDF uploaded to S3:', pdfUrl);
    } catch (s3Error) {
      console.error('S3 upload error:', s3Error);
      return NextResponse.json(
        { error: 'Failed to upload PDF to S3' },
        { status: 500 }
      );
    }

    // Create draft
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

    const draft = await DraftQuiz.create({
      userId,
      title: title.trim(),
      categoryId: categoryId || undefined,
      pdfData: {
        fileName,
        fileSize: buffer.length,
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

    return NextResponse.json({
      draftId: draft._id.toString(),
      title: draft.title,
      chunks: {
        total: chunkDetails.length,
        chunkDetails: chunkDetails.map(c => ({
          index: c.index,
          startPage: c.startPage,
          endPage: c.endPage,
          status: c.status,
        })),
      },
      totalPages,
      expiresAt: draft.expiresAt,
    });

  } catch (error) {
    console.error('Draft create error:', error);
    return NextResponse.json(
      { error: 'Failed to create draft' },
      { status: 500 }
    );
  }
}
