import { NextRequest, NextResponse } from 'next/server';
import { serviceFactory } from '@/lib/serviceFactory';

// GET /api/categories/stats - Get category statistics for public display
export async function GET(request: NextRequest) {
  try {
    const categoryService = serviceFactory.getCategoryService();
    
    const result = await categoryService.getCategoryStats();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    // Transform the data to match expected format
    const categoriesWithStats = result.data;
    if (!categoriesWithStats) {
      return NextResponse.json(
        { success: false, error: 'No category data found' },
        { status: 404 }
      );
    }
    
    const hotCategories = categoriesWithStats.slice(0, 3);

    return NextResponse.json({
      success: true,
      data: {
        hotCategories,
        allCategories: categoriesWithStats,
        totalCategories: categoriesWithStats.length
      }
    });

  } catch (error: any) {
    console.error('Get category stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 