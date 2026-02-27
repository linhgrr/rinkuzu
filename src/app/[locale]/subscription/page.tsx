'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import Navigation from '@/components/Navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  HiOutlineCheck,
  HiOutlineShieldCheck,
  HiOutlineClock,
  HiOutlineStar,
  HiOutlineLightBulb
} from '@/components/icons'

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  durationDisplay?: string;
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
  const t = useTranslations('subscription')
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const fetchPlans = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription/plans')
      const data = await response.json()
      if (data.success) {
        setPlans(data.plans)
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
    }
  }, [])

  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription/status')
      const data = await response.json()
      if (data.success) {
        setSubscriptionStatus(data.data)
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    }
  }, [])

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          fetchPlans(),
          fetchSubscriptionStatus()
        ])
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [fetchPlans, fetchSubscriptionStatus])

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
        toast.error(data.message || 'Failed to create payment request')
      }
    } catch (error) {
      console.error('Error creating payment:', error)
      toast.error('Failed to create payment request')
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
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      <Navigation />
      <div className="py-6 md:py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">
              {t('upgrade')} <HiOutlineStar className="inline-block text-yellow-500 mb-1" />
            </h1>
            <p className="text-base md:text-lg text-gray-600">
              {t('subtitle')}
            </p>
          </div>

          {/* Current Subscription Status */}
          {subscriptionStatus?.subscription && (
            <Card className="mb-6 md:mb-8 p-4 md:p-6 bg-blue-50 border-blue-200">
              <h2 className="text-lg md:text-xl font-semibold text-blue-900 mb-3 md:mb-4">
                {t('currentPlan')} <HiOutlineShieldCheck className="inline-block ml-1" />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <p className="text-sm text-blue-700">{t('title')}</p>
                  <p className="font-medium text-blue-900">
                    {subscriptionStatus.subscription.type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">{t('expiresOn')}</p>
                  <p className="font-medium text-blue-900">
                    {subscriptionStatus.subscription.endDate
                      ? formatDate(subscriptionStatus.subscription.endDate)
                      : '-'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Subscription Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {plans.map((plan, index) => (
              <Card key={plan.id} className="p-4 md:p-6 relative">
                {index === 1 && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-500 text-white px-3 md:px-4 py-1 rounded-full text-xs md:text-sm font-medium">
                      {t('popular')}
                    </span>
                  </div>
                )}

                <div className="text-center mb-4 md:mb-6">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <div className="text-2xl md:text-4xl font-bold text-blue-600 mb-2">
                    {formatPrice(plan.price)}
                  </div>
                  <p className="text-sm md:text-base text-gray-600">{plan.durationDisplay || plan.duration}</p>
                </div>

                <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <HiOutlineCheck className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
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
                    ? t('premiumPlan')
                    : t('subscribe')}
                </Button>
              </Card>
            ))}
          </div>

          <ConfirmModal
            isOpen={showPaymentModal}
            title={t('subscribe')}
            message={(
              <div className="space-y-4">
                <p className="text-gray-700">
                  {selectedPlan?.name} - {selectedPlan ? formatPrice(selectedPlan.price) : ''}
                </p>
              </div>
            )}
            confirmText={t('subscribe')}
            cancelText={t('cancel')}
            isLoading={paymentLoading}
            onCancel={() => setShowPaymentModal(false)}
            onConfirm={confirmPurchase}
          />
        </div>
      </div>
    </div>
  )
}
