import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import { DurationUtils } from '@/types/subscription';
import { apiErr } from '@/lib/api/response';

type AdminSessionUser = { role: string; id?: string; email?: string };

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as AdminSessionUser).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    await connectDB();

    const plans = await Plan.find().lean();

    return NextResponse.json({ success: true, data: plans });
  } catch (error: unknown) {
    console.error('Admin get plans error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

// PATCH to update a plan { id, ...fields }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as AdminSessionUser).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const body = await request.json();
    const { id, name, price, duration, features, isActive } = body;
    if (!id) {
      return apiErr('validation_error', 'Plan ID required', 400);
    }

    await connectDB();
    const update: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return apiErr('validation_error', 'Plan name is required', 400);
      }
      update['name'] = name.trim();
    }
    if (price !== undefined) {
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
        return apiErr('validation_error', 'Plan price must be greater than 0', 400);
      }
      update['price'] = price;
    }
    if (duration !== undefined) {
      if (typeof duration !== 'string' || !DurationUtils.isValidISO8601Duration(duration)) {
        return apiErr('validation_error', 'Invalid duration format', 400);
      }
      update['duration'] = duration;
    }
    if (features !== undefined) {
      if (!Array.isArray(features) || features.some((f) => typeof f !== 'string')) {
        return apiErr('validation_error', 'Invalid plan features', 400);
      }
      update['features'] = features.map((f: string) => f.trim()).filter(Boolean);
    }
    if (isActive !== undefined) update['isActive'] = isActive;

    const updated = await Plan.findByIdAndUpdate(id, update, { new: true, upsert: false }).lean();
    if (!updated) {
      return apiErr('not_found', 'Plan not found', 404);
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('Admin update plan error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

// POST to create a new plan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as AdminSessionUser).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const body = await request.json();
    const { name, price, duration, features = [], isActive = true } = body;

    // Validation
    if (!name || name.trim() === '') {
      return apiErr('validation_error', 'Plan name is required', 400);
    }
    if (!price || price <= 0) {
      return apiErr('validation_error', 'Plan price must be greater than 0', 400);
    }
    if (!duration || !DurationUtils.isValidISO8601Duration(duration)) {
      return apiErr(
        'validation_error',
        'Invalid duration format. Use ISO 8601 format (P1M, P3M, P1Y, PT0S)',
        400,
      );
    }

    await connectDB();

    // Generate unique ID based on name and duration
    const planId = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${duration.toLowerCase()}`;

    // Check if plan with this ID already exists
    const existingPlan = await Plan.findById(planId);
    if (existingPlan) {
      return apiErr('validation_error', 'A plan with this name and duration already exists', 409);
    }

    const newPlan = new Plan({
      _id: planId,
      name: name.trim(),
      price: Number(price),
      duration,
      features: features.filter((f: string) => f.trim() !== ''), // Remove empty features
      isActive,
    });

    const savedPlan = await newPlan.save();

    return NextResponse.json({ success: true, data: savedPlan });
  } catch (error: unknown) {
    console.error('Admin create plan error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

// DELETE to remove a plan
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as AdminSessionUser).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return apiErr('validation_error', 'Plan ID is required', 400);
    }

    await connectDB();

    const deletedPlan = await Plan.findByIdAndDelete(id);
    if (!deletedPlan) {
      return apiErr('not_found', 'Plan not found', 404);
    }

    return NextResponse.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error: unknown) {
    console.error('Admin delete plan error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
