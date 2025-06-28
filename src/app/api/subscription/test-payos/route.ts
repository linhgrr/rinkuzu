import { NextRequest, NextResponse } from 'next/server'
import PayOSService from '@/services/payment/PayOSService'

export async function GET() {
  try {
    const payosService = new PayOSService()
    
    // Test the connection
    const isConnected = await payosService.testConnection()
    
    if (!isConnected) {
      return NextResponse.json(
        { error: 'PayOS service connection failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'PayOS service is working correctly',
      environment: {
        clientId: !!process.env.PAYOS_CLIENT_ID,
        apiKey: !!process.env.PAYOS_API_KEY,
        checksumKey: !!process.env.PAYOS_CHECKSUM_KEY,
        baseUrl: 'https://api-merchant.payos.vn'
      }
    })
  } catch (error) {
    console.error('PayOS test error:', error)
    return NextResponse.json(
      { error: 'PayOS test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 