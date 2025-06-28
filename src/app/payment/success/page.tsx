'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const orderCode = searchParams.get('orderCode')
    if (!orderCode) {
      setStatus('error')
      setMessage('Không tìm thấy mã đơn hàng')
      return
    }

    verifyPayment(orderCode)
  }, [searchParams])

  const verifyPayment = async (orderCode: string) => {
    try {
      const response = await fetch('/api/subscription/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderCode }),
      })

      const data = await response.json()
      
      if (data.success) {
        setStatus('success')
        setMessage('Thanh toán thành công! Gói Premium của bạn đã được kích hoạt.')
      } else {
        setStatus('error')
        setMessage(data.message || 'Có lỗi xảy ra khi xác minh thanh toán')
      }
    } catch (error) {
      console.error('Error verifying payment:', error)
      setStatus('error')
      setMessage('Có lỗi xảy ra khi xác minh thanh toán')
    }
  }

  const handleGoHome = () => {
    router.push('/')
  }

  const handleGoToSubscription = () => {
    router.push('/subscription')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang xác minh thanh toán...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      <div className="max-w-md mx-auto px-4">
        <Card className="p-8 text-center">
          {status === 'success' ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Thanh Toán Thành Công!
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <Button onClick={handleGoHome} className="w-full">
                  Về Trang Chủ
                </Button>
                <Button onClick={handleGoToSubscription} variant="outline" className="w-full">
                  Xem Gói Premium
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Có Lỗi Xảy Ra
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <Button onClick={handleGoHome} className="w-full">
                  Về Trang Chủ
                </Button>
                <Button onClick={handleGoToSubscription} variant="outline" className="w-full">
                  Thử Lại
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
} 