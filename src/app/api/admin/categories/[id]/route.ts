import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';
import Quiz from '@/models/Quiz';
import { authOptions } from '@/lib/auth';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr } from '@/lib/api/response';

// GET /api/admin/categories/[id] - Get single category
export async function GET(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    await connectDB();

    const category = await Category.findById(id).populate('createdBy', 'email');

    if (!category) {
      return apiErr('not_found', 'Category not found', 404);
    }

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    console.error('Get category error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

// PUT /api/admin/categories/[id] - Update category
export async function PUT(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const body = await request.json();
    const { name, description, color, isActive } = body;

    if (!name?.trim()) {
      return apiErr('validation_error', 'Category name is required', 400);
    }

    await connectDB();

    const category = await Category.findById(id);

    if (!category) {
      return apiErr('not_found', 'Category not found', 404);
    }

    // Check if name already exists (excluding current category)
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${name.trim()}$`, $options: 'i' },
    });

    if (existingCategory) {
      return apiErr('validation_error', 'Category with this name already exists', 400);
    }

    category.name = name.trim();
    category.description = description?.trim();
    category.color = color || category.color;
    category.isActive = isActive !== undefined ? isActive : category.isActive;

    await category.save();
    await category.populate('createdBy', 'email');

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    console.error('Update category error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

// DELETE /api/admin/categories/[id] - Delete category
export async function DELETE(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    await connectDB();

    const category = await Category.findById(id);

    if (!category) {
      return apiErr('not_found', 'Category not found', 404);
    }

    // Check if category is being used by any quizzes
    const quizCount = await Quiz.countDocuments({ category: id });

    if (quizCount > 0) {
      return apiErr(
        'validation_error',
        `Cannot delete category. It is being used by ${quizCount} quiz${quizCount > 1 ? 'es' : ''}`,
        400,
      );
    }

    await Category.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete category error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
