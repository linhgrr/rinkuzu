import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';
import Quiz from '@/models/Quiz';
import { apiErr, apiOk } from '@/lib/api/response';

// GET /api/admin/categories/[id] - Get single category
export const GET = withAdmin(async (_request: NextRequest, context) => {
  try {
    const { id } = await context.params;

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
});

// PUT /api/admin/categories/[id] - Update category
export const PUT = withAdmin(async (request: NextRequest, context) => {
  try {
    const { id } = await context.params;
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
});

// DELETE /api/admin/categories/[id] - Delete category
export const DELETE = withAdmin(async (_request: NextRequest, context) => {
  try {
    const { id } = await context.params;

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

    return apiOk(null, 200, { message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Delete category error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
