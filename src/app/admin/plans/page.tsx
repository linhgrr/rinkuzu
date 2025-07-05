'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import Sidebar from '@/components/Sidebar'
import { SubscriptionDurationType, PREDEFINED_DURATIONS, DurationUtils } from '@/types/subscription'
import { Modal } from '@/components/ui/Modal'

interface Plan {
  _id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  durationInfo?: {
    iso8601: string;
    displayName: string;
    months?: number;
  };
  isLifetime?: boolean;
}

interface NewPlanForm {
  name: string;
  price: number | '';
  duration: string;
  features: string[];
  isActive: boolean;
}

export default function AdminPlansPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Plan>>({})
  
  // New plan creation state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<NewPlanForm>({
    name: '',
    price: '',
    duration: SubscriptionDurationType.MONTHLY,
    features: [''],
    isActive: true
  })
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/login')
      return
    }

    if ((session.user as any)?.role !== 'admin') {
      router.push('/')
      return
    }

    fetchPlans()
  }, [session, status, router])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/plans')
      const data = await response.json()

      if (data.success) {
        setPlans(data.data)
        setError('')
      } else {
        setError(data.error || 'Failed to fetch plans')
      }
    } catch (error) {
      setError('Failed to fetch plans')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan._id)
    setEditForm({
      name: plan.name,
      price: plan.price,
      duration: plan.duration,
      features: [...plan.features],
      isActive: plan.isActive
    })
  }

  const handleCancelEdit = () => {
    setEditingPlan(null)
    setEditForm({})
  }

  const handleSaveEdit = async (planId: string) => {
    try {
      const response = await fetch(`/api/admin/plans`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: planId,
          ...editForm
        }),
      })

      const data = await response.json()

      if (data.success) {
        setPlans(plans.map(plan => 
          plan._id === planId ? { ...plan, ...editForm } : plan
        ))
        setSuccess('Plan updated successfully')
        setEditingPlan(null)
        setEditForm({})
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Failed to update plan')
      }
    } catch (error) {
      setError('Failed to update plan')
    }
  }

  const handleCreatePlan = async () => {
    if (!createForm.name.trim() || !createForm.price || createForm.price <= 0) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setCreateLoading(true)
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          price: Number(createForm.price),
          duration: createForm.duration,
          features: createForm.features.filter(f => f.trim() !== ''),
          isActive: createForm.isActive
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Plan created successfully')
        setShowCreateForm(false)
        setCreateForm({
          name: '',
          price: '',
          duration: SubscriptionDurationType.MONTHLY,
          features: [''],
          isActive: true
        })
        fetchPlans() // Refresh plans list
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Failed to create plan')
      }
    } catch (error) {
      setError('Failed to create plan')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to delete the plan "${planName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/admin/plans', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: planId }),
      })

      const data = await response.json()

      if (data.success) {
        setPlans(plans.filter(plan => plan._id !== planId))
        setSuccess('Plan deleted successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Failed to delete plan')
      }
    } catch (error) {
      setError('Failed to delete plan')
    }
  }

  const handleFeatureChange = (index: number, value: string, isCreate = false) => {
    if (isCreate) {
      const newFeatures = [...createForm.features]
      newFeatures[index] = value
      setCreateForm({ ...createForm, features: newFeatures })
    } else {
    const newFeatures = [...(editForm.features || [])]
    newFeatures[index] = value
    setEditForm({ ...editForm, features: newFeatures })
  }
  }

  const addFeature = (isCreate = false) => {
    if (isCreate) {
      setCreateForm({ 
        ...createForm, 
        features: [...createForm.features, ''] 
      })
    } else {
    setEditForm({ 
      ...editForm, 
      features: [...(editForm.features || []), ''] 
    })
  }
  }

  const removeFeature = (index: number, isCreate = false) => {
    if (isCreate) {
      const newFeatures = [...createForm.features]
      newFeatures.splice(index, 1)
      setCreateForm({ ...createForm, features: newFeatures })
    } else {
    const newFeatures = [...(editForm.features || [])]
    newFeatures.splice(index, 1)
    setEditForm({ ...editForm, features: newFeatures })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount)
  }

  const getDurationDisplay = (duration: string) => {
    try {
      if (DurationUtils.isValidISO8601Duration(duration)) {
        const info = DurationUtils.getDurationInfo(duration)
        return info.displayName
      }
      // Fallback for legacy durations
    if (duration === '0') return 'Lifetime'
    if (duration === '6') return '6 Months'
    if (duration === '12') return '1 Year'
    return `${duration} Months`
    } catch {
      return duration
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
              </Link>
              <span className="ml-3 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                Admin
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {session ? (
                <>
                  <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                    All Quizzes
                  </Link>
                  
                  {/* User Menu */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {session.user?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <svg className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                        <button 
                          onClick={() => signOut()}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link href="/login">
                    <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-4">
              <div className="space-y-2">
                {session ? (
                  <>
                    <Link href="/" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      All Quizzes
                    </Link>
                    <button 
                      onClick={() => signOut()}
                      className="block w-full text-left px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Sign In
                    </Link>
                    <Link href="/register" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main className={`py-8 transition-all duration-300 ${
        session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : ''
      } max-w-none px-4 sm:px-6 lg:px-8`}>
        {status === 'loading' ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : !session ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Redirecting to login...</div>
          </div>
        ) : (session.user as any)?.role !== 'admin' ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Access denied. Admin privileges required.</div>
          </div>
        ) : (
        <>
        <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pricing Plans Management</h1>
            <p className="mt-2 text-gray-600">
              Manage subscription plans and pricing
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            variant="default"
            className="rounded-full shadow-md flex items-center gap-2 px-4 py-2"
            title="Create New Plan"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Plan
          </Button>
        </div>

        {/* Create Plan Modal */}
        <Modal
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          title="Create New Subscription Plan"
          description="Add a new subscription plan with ISO 8601 duration format"
          size="medium"
        >
          <form
            onSubmit={e => {
              e.preventDefault()
              handleCreatePlan()
            }}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Name *
                  </label>
                  <Input
                    type="text"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g., Premium Monthly"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (VND) *
                  </label>
                  <Input
                    type="number"
                    value={createForm.price}
                    onChange={e => setCreateForm({ ...createForm, price: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="99000"
                    min="0"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration *
                  </label>
                  <select
                    value={createForm.duration}
                    onChange={e => setCreateForm({ ...createForm, duration: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    title="Select plan duration"
                  >
                    {Object.entries(PREDEFINED_DURATIONS).map(([key, duration]) => (
                      <option key={key} value={duration.iso8601}>
                        {duration.displayName} ({duration.iso8601})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={createForm.isActive.toString()}
                    onChange={e => setCreateForm({ ...createForm, isActive: e.target.value === 'true' })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    title="Select plan status"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Features
                </label>
                {createForm.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <Input
                      type="text"
                      value={feature}
                      onChange={e => handleFeatureChange(index, e.target.value, true)}
                      placeholder="Enter feature"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => removeFeature(index, true)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      title="Remove this feature"
                    >
                      <span className="sr-only">Remove this feature</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => addFeature(true)}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  + Add Feature
                </Button>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createLoading ? 'Creating...' : 'Create Plan'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>

        {/* End Create Plan Modal */}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Plans Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading plans...</div>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">No plans found</div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan._id} className="relative">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      {editingPlan === plan._id ? (
                        <Input
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="text-xl font-bold"
                        />
                      ) : (
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                      )}
                      <CardDescription className="mt-2">
                        {getDurationDisplay(plan.duration)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        plan.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Price */}
                  <div className="mb-6">
                    {editingPlan === plan._id ? (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Price (VND)
                        </label>
                        <Input
                          type="number"
                          value={editForm.price || 0}
                          onChange={(e) => setEditForm({ ...editForm, price: parseInt(e.target.value) })}
                          className="text-2xl font-bold"
                        />
                      </div>
                    ) : (
                      <div className="text-3xl font-bold text-gray-900">
                        {formatCurrency(plan.price)}
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Features:</h4>
                    {editingPlan === plan._id ? (
                      <div className="space-y-2">
                        {(editForm.features || []).map((feature, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Input
                              value={feature}
                              onChange={(e) => handleFeatureChange(index, e.target.value)}
                              placeholder="Feature description"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeFeature(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addFeature(false)}
                          className="w-full"
                        >
                          Add Feature
                        </Button>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center text-sm text-gray-600">
                            <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Status Toggle */}
                  {editingPlan === plan._id && (
                    <div className="mt-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editForm.isActive || false}
                          onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Active</span>
                      </label>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-6 flex space-x-2">
                    {editingPlan === plan._id ? (
                      <>
                        <Button
                          onClick={() => handleSaveEdit(plan._id)}
                          className="flex-1"
                          variant="gradient"
                        >
                          Save Changes
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleEdit(plan)}
                        variant="outline"
                        className="w-full"
                      >
                        Edit Plan
                      </Button>
                    )}
                  </div>

                  {/* Plan Info */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Created: {new Date(plan.createdAt).toLocaleDateString()}</div>
                      <div>Updated: {new Date(plan.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
        </>
        )}
      </main>
    </div>
  )
} 