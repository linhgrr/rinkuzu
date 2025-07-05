import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ServiceFactory } from '@/lib/serviceFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const searchParamsObj = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      search: searchParams.get('search')
    }

    const subscriptionService = ServiceFactory.createSubscriptionService()
    const result = await subscriptionService.getSubscriptionHistory('')

    // Filter and paginate results based on search params
    let filteredResults = result
    if (searchParamsObj.status) {
      filteredResults = result.filter((sub: any) => sub.status === searchParamsObj.status)
    }
    if (searchParamsObj.search) {
      const searchLower = searchParamsObj.search.toLowerCase()
      filteredResults = filteredResults.filter((sub: any) => 
        sub.userEmail?.toLowerCase().includes(searchLower) ||
        sub.payosOrderId?.toLowerCase().includes(searchLower)
      )
    }

    const page = parseInt(searchParamsObj.page || '1')
    const limit = parseInt(searchParamsObj.limit || '20')
    const total = filteredResults.length
    const startIndex = (page - 1) * limit
    const paginatedResults = filteredResults.slice(startIndex, startIndex + limit)

    return NextResponse.json({ 
      success: true, 
      data: { 
        subscriptions: paginatedResults, 
        pagination: { 
          total, 
          page, 
          limit, 
          totalPages: Math.ceil(total / limit) || 1 
        } 
      } 
    })
  } catch (error: any) {
    console.error('Admin subscriptions list error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 