import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongoose'
import Plan, { IPlan } from '@/models/Plan'

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