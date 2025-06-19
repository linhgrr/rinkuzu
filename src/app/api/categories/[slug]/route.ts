import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';

// GET /api/categories/[slug] - Get category by slug
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await connectDB();

    const slug = params.slug;
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Slug is required' },
        { status: 400 }
      );
    }

    // Convert slug back to category name (simple approach)
    // slug format: "toan-hoc" -> "Toán học"
    const categoryName = decodeURIComponent(slug)
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    console.log('🔍 Looking for category:', { slug, categoryName });

    // Find category by name (case insensitive)
    const category = await Category.findOne({ 
      name: { $regex: new RegExp(`^${categoryName}$`, 'i') },
      isActive: true 
    });

    if (!category) {
      // Try alternative search - find all categories and match by slug
      const allCategories = await Category.find({ isActive: true });
      const foundCategory = allCategories.find(cat => 
        cat.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
      );

      if (!foundCategory) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: foundCategory
      });
    }

    return NextResponse.json({
      success: true,
      data: category
    });

  } catch (error: any) {
    console.error('Get category by slug error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 