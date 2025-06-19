import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';
import Quiz from '@/models/Quiz';
import { authOptions } from '@/lib/auth';

// GET /api/admin/categories/[id] - Get single category
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    await connectDB();

    const category = await Category.findById(params.id).populate('createdBy', 'email');

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: category
    });

  } catch (error: any) {
    console.error('Get category error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/categories/[id] - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, color, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const category = await Category.findById(params.id);

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if name already exists (excluding current category)
    const existingCategory = await Category.findOne({ 
      _id: { $ne: params.id },
      name: { $regex: `^${name.trim()}$`, $options: 'i' } 
    });

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Category with this name already exists' },
        { status: 400 }
      );
    }

    category.name = name.trim();
    category.description = description?.trim();
    category.color = color || category.color;
    category.isActive = isActive !== undefined ? isActive : category.isActive;

    await category.save();
    await category.populate('createdBy', 'email');

    return NextResponse.json({
      success: true,
      data: category
    });

  } catch (error: any) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/categories/[id] - Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    await connectDB();

    const category = await Category.findById(params.id);

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if category is being used by any quizzes
    const quizCount = await Quiz.countDocuments({ category: params.id });

    if (quizCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete category. It is being used by ${quizCount} quiz${quizCount > 1 ? 'es' : ''}` },
        { status: 400 }
      );
    }

    await Category.findByIdAndDelete(params.id);

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete category error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 