import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';
import Quiz from '@/models/Quiz';
import { authOptions } from '@/lib/auth';

// GET /api/categories/stats - Get category statistics for public display
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Get all active categories with quiz counts
    const categoriesWithStats = await Category.aggregate([
      // Match only active categories
      { $match: { isActive: true } },
      
      // Lookup quizzes for each category
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: 'category',
          as: 'quizzes',
          pipeline: [
            { $match: { status: 'published' } } // Only count published quizzes
          ]
        }
      },
      
      // Add quiz count field
      {
        $addFields: {
          quizCount: { $size: '$quizzes' }
        }
      },
      
      // Remove the quizzes array (we only need the count)
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          color: 1,
          quizCount: 1,
          createdAt: 1
        }
      },
      
      // Sort by quiz count (descending) then by name
      {
        $sort: { quizCount: -1, name: 1 }
      }
    ]);

    // Get hot categories (top 3 with most quizzes)
    const hotCategories = categoriesWithStats.slice(0, 3);

    // Get all categories for navigation
    const allCategories = categoriesWithStats;

    return NextResponse.json({
      success: true,
      data: {
        hotCategories,
        allCategories,
        totalCategories: allCategories.length
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