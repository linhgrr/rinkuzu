// /src/app/api/draft/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import { deletePDF } from '@/lib/s3';

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
    }).lean() as any;

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Refresh signed URL if PDF exists
    if (draft.pdfData?.pdfKey) {
      try {
        const { getSignedPDFUrl } = await import('@/lib/s3');
        draft.pdfData.pdfUrl = await getSignedPDFUrl(draft.pdfData.pdfKey);
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

    // Find draft first to get pdfKey
    const draft = await DraftQuiz.findOne({
      _id: params.id,
      userId: (session!.user as any).id,
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Delete from MongoDB
    await DraftQuiz.deleteOne({ _id: params.id });

    // Cleanup S3 (best effort, don't fail if this fails)
    if (draft.pdfData?.pdfKey) {
      try {
        await deletePDF(draft.pdfData.pdfKey);
        console.log('Deleted PDF from S3:', draft.pdfData.pdfKey);
      } catch (s3Error) {
        console.error('Failed to delete PDF from S3:', s3Error);
        // Don't fail the request, S3 cleanup is best-effort
      }
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
