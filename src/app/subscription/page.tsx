'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
}

interface SubscriptionStatus {
  subscription?: {
    type: string
    startDate?: string
    endDate?: string
    isActive: boolean
  }
  isPremium: boolean
}

export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    fetchPlans()
    fetchSubscriptionStatus()
  }, [status, session])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscription/plans')
      const data = await response.json()
      if (data.success) {
        setPlans(data.plans)
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
    }
  }

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscription/status')
      const data = await response.json()
      if (data.success) {
        setSubscriptionStatus(data.data)
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (plan: SubscriptionPlan) => {
    setSelectedPlan(plan)
    setShowPaymentModal(true)
  }

  const confirmPurchase = async () => {
    if (!selectedPlan) return

    setPaymentLoading(true)
    try {
      const response = await fetch('/api/subscription/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId: selectedPlan.id }),
      })

      const data = await response.json()
      if (data.success) {
        // Redirect to PayOS payment page
        window.location.href = data.data.paymentUrl
      } else {
        alert(data.message || 'Failed to create payment request')
      }
    } catch (error) {
      console.error('Error creating payment:', error)
      alert('Failed to create payment request')
    } finally {
      setPaymentLoading(false)
      setShowPaymentModal(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('vi-VN')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="py-8">
        <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Nâng Cấp Tài Khoản
          </h1>
          <p className="text-lg text-gray-600">
            Truy cập tất cả quiz private và tính năng cao cấp
          </p>
        </div>

        {/* Current Subscription Status */}
        {subscriptionStatus?.subscription && (
          <Card className="mb-8 p-6 bg-blue-50 border-blue-200">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">
              Trạng Thái Gói Hiện Tại
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-700">Loại gói:</p>
                <p className="font-medium text-blue-900">
                  {subscriptionStatus.subscription.type}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Ngày bắt đầu:</p>
                <p className="font-medium text-blue-900">
                  {formatDate(subscriptionStatus.subscription.startDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Ngày kết thúc:</p>
                <p className="font-medium text-blue-900">
                  {subscriptionStatus.subscription.endDate 
                    ? formatDate(subscriptionStatus.subscription.endDate)
                    : 'Không giới hạn'}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                subscriptionStatus.isPremium 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {subscriptionStatus.isPremium ? 'Đang hoạt động' : 'Đã hết hạn'}
              </span>
            </div>
          </Card>
        )}

        {/* Subscription Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {plans.map((plan, index) => (
            <Card key={plan.id} className="p-6 relative">
              {index === 1 && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Phổ Biến
                  </span>
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {formatPrice(plan.price)}
                </div>
                <p className="text-gray-600">{plan.duration}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handlePurchase(plan)}
                disabled={subscriptionStatus?.isPremium}
                className="w-full"
                variant={index === 1 ? 'default' : 'outline'}
              >
                {subscriptionStatus?.isPremium 
                  ? 'Đã có gói Premium' 
                  : `Mua ${plan.name}`}
              </Button>
            </Card>
          ))}
        </div>

        {/* Payment Confirmation Modal */}
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title="Xác Nhận Thanh Toán"
        >
          <div className="p-6">
            <p className="text-gray-700 mb-4">
              Bạn sắp mua gói <strong>{selectedPlan?.name}</strong> với giá{' '}
              <strong>{selectedPlan ? formatPrice(selectedPlan.price) : ''}</strong>
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Sau khi xác nhận, bạn sẽ được chuyển đến trang thanh toán PayOS để hoàn tất giao dịch.
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowPaymentModal(false)}
                variant="outline"
                className="flex-1"
              >
                Hủy
              </Button>
              <Button
                onClick={confirmPurchase}
                disabled={paymentLoading}
                className="flex-1"
              >
                {paymentLoading ? 'Đang xử lý...' : 'Xác Nhận Thanh Toán'}
              </Button>
            </div>
          </div>
        </Modal>
        </div>
      </div>
    </div>
  )
} 