import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Report from '@/models/Report';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();

    const { status, adminNotes } = await request.json();
    
    if (!['pending', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
      resolvedBy: session.user.email
    };

    if (status !== 'pending') {
      updateData.resolvedAt = new Date();
    }

    if (adminNotes) {
      updateData.adminNotes = adminNotes.trim();
    }

    const report = await Report.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true }
    );

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();

    const report = await Report.findByIdAndDelete(params.id);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 