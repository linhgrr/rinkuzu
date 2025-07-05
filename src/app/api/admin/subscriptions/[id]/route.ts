import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ServiceFactory } from '@/lib/serviceFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const subscriptionService = ServiceFactory.createSubscriptionService()
    
    // Get all subscription history and find the specific one
    const allSubscriptions = await subscriptionService.getSubscriptionHistory('')
    const subscription = allSubscriptions.find((sub: any) => sub._id.toString() === params.id)

    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: subscription })
  } catch (error: any) {
    console.error('Admin subscription detail error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const subscriptionService = ServiceFactory.createSubscriptionService()
    const result = await subscriptionService.updateSubscriptionById(params.id, body)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error('Admin subscription update error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 