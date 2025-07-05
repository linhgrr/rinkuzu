import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongoose'
import Plan, { IPlan } from '@/models/Plan'
import { DurationUtils, SubscriptionDurationType } from '@/types/subscription'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    await connectDB()

    const plans = await Plan.find().lean()
    
    return NextResponse.json({ success: true, data: plans })
  } catch (error: any) {
    console.error('Admin get plans error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH to update a plan { id, ...fields }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, price, duration, features, isActive } = body
    if (!id) {
      return NextResponse.json({ success: false, error: 'Plan ID required' }, { status: 400 })
    }

    await connectDB()
    const update: any = {}
    if (name !== undefined) update.name = name
    if (price !== undefined) update.price = price
    if (duration !== undefined) update.duration = duration
    if (features !== undefined) update.features = features
    if (isActive !== undefined) update.isActive = isActive

    const updated = await Plan.findByIdAndUpdate(id, update, { new: true, upsert: false }).lean()
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Admin update plan error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST to create a new plan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, price, duration, features = [], isActive = true } = body

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json({ success: false, error: 'Plan name is required' }, { status: 400 })
    }
    if (!price || price <= 0) {
      return NextResponse.json({ success: false, error: 'Plan price must be greater than 0' }, { status: 400 })
    }
    if (!duration || !DurationUtils.isValidISO8601Duration(duration)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid duration format. Use ISO 8601 format (P1M, P3M, P1Y, PT0S)' 
      }, { status: 400 })
    }

    await connectDB()

    // Generate unique ID based on name and duration
    const planId = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${duration.toLowerCase()}`

    // Check if plan with this ID already exists
    const existingPlan = await Plan.findById(planId)
    if (existingPlan) {
      return NextResponse.json({ 
        success: false, 
        error: 'A plan with this name and duration already exists' 
      }, { status: 409 })
    }

    const newPlan = new Plan({
      _id: planId,
      name: name.trim(),
      price: Number(price),
      duration,
      features: features.filter((f: string) => f.trim() !== ''), // Remove empty features
      isActive
    })

    const savedPlan = await newPlan.save()
    
    return NextResponse.json({ success: true, data: savedPlan })
  } catch (error: any) {
    console.error('Admin create plan error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE to remove a plan
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Plan ID is required' }, { status: 400 })
    }

    await connectDB()

    const deletedPlan = await Plan.findByIdAndDelete(id)
    if (!deletedPlan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Plan deleted successfully' })
  } catch (error: any) {
    console.error('Admin delete plan error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 