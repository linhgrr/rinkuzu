'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

function PaymentCancelContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderCode = searchParams.get('orderCode')

  const handleGoHome = () => {
    router.push('/')
  }

  const handleGoToSubscription = () => {
    router.push('/subscription')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      <div className="max-w-md mx-auto px-4">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Thanh Toán Bị Hủy
          </h1>
          <p className="text-gray-600 mb-6">
            Bạn đã hủy quá trình thanh toán. Gói Premium chưa được kích hoạt.
            {orderCode && (
              <span className="block text-sm text-gray-500 mt-2">
                Mã đơn hàng: {orderCode}
              </span>
            )}
          </p>
          <div className="space-y-3">
            <Button onClick={handleGoHome} className="w-full">
              Về Trang Chủ
            </Button>
            <Button onClick={handleGoToSubscription} variant="outline" className="w-full">
              Thử Lại Thanh Toán
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    }>
      <PaymentCancelContent />
    </Suspense>
  )
} 