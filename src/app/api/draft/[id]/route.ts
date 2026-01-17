// /src/app/api/draft/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const draft = await DraftQuiz.findOne({
      _id: params.id,
      userId: ((session!.user as any) as any).id,
    }).select('-pdfData.base64').lean() as any; // Cast to any to avoid TS error with lean()

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Refresh signed URL if PDF exists
    if (draft.pdfData?.pdfUrl) {
      try {
        const { getSignedPDFUrl, BUCKET_NAME } = await import('@/lib/s3');
        const pdfUrl = draft.pdfData.pdfUrl;

        // Extract key: everything after "bucket-name/"
        const marker = `${BUCKET_NAME}/`;
        if (pdfUrl.includes(marker)) {
          const key = pdfUrl.split(marker)[1];
          if (key) {
            draft.pdfData.pdfUrl = await getSignedPDFUrl(key);
          }
        }
      } catch (error) {
        console.error('Failed to refresh signed URL:', error);
      }
    }

    return NextResponse.json({ draft });

  } catch (error) {
    console.error('Get draft error:', error);
    return NextResponse.json(
      { error: 'Failed to get draft' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const result = await DraftQuiz.deleteOne({
      _id: params.id,
      userId: ((session!.user as any) as any).id,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete draft error:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
