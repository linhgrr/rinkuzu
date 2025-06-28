import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongoose'
import Subscription from '@/models/Subscription'
import User from '@/models/User'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // pending | completed | failed | cancelled
    const search = searchParams.get('search')

    await connectDB()

    const filter: any = {}
    if (status) filter.status = status
    if (search) {
      const regex = new RegExp(search, 'i')
      filter.$or = [{ userEmail: regex }, { payosOrderId: regex }]
    }

    const total = await Subscription.countDocuments(filter)
    const subscriptions = await Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'email role')
      .lean()

    const totalPages = Math.ceil(total / limit) || 1
    return NextResponse.json({ success: true, data: { subscriptions, pagination: { total, page, limit, totalPages } } })
  } catch (error: any) {
    console.error('Admin subscriptions list error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 