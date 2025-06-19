import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';
import { authOptions } from '@/lib/auth';

// GET /api/categories/search - Search categories for quiz creation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    let query: any = { isActive: true };
    
    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const categories = await Category.find(query)
      .select('_id name description color')
      .sort({ name: 1 })
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: categories
    });

  } catch (error: any) {
    console.error('Search categories error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 