import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongoose'
import Subscription from '@/models/Subscription'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { status, isActive } = body

    await connectDB()

    const update: any = {}
    if (status) update.status = status
    if (typeof isActive === 'boolean') update.isActive = isActive

    const updated = await Subscription.findByIdAndUpdate(id, update, { new: true }).lean()
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Admin update subscription error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 