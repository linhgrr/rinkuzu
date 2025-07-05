'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Pagination from '@/components/ui/Pagination'
import Sidebar from '@/components/Sidebar'

interface Subscription {
  _id: string
  userEmail: string
  user: string
  type: 'monthly' | 'yearly' | 'lifetime'
  amount: number
  status: 'pending' | 'active' | 'cancelled' | 'expired'
  payosOrderId: string
  payosTransactionId?: string
  startDate: string
  endDate?: string
  createdAt: string
  updatedAt: string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminSubscriptionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  
  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)

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

    fetchSubscriptions()
  }, [session, status, router])

  const fetchSubscriptions = async (page: number = 1, search: string = '', status: string = '') => {
    if (!session) return
    
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      })

      if (search.trim()) {
        params.append('search', search.trim())
      }

      if (status) {
        params.append('status', status)
      }

      const response = await fetch(`/api/admin/subscriptions?${params}`)
      const data = await response.json()

      if (data.success) {
        setSubscriptions(data.data.subscriptions)
        setPagination({
          page: data.data.pagination.currentPage,
          limit: data.data.pagination.itemsPerPage,
          total: data.data.pagination.totalItems,
          totalPages: data.data.pagination.totalPages
        })
        setError('')
      } else {
        setError(data.error || 'Failed to fetch subscriptions')
      }
    } catch (error) {
      setError('Failed to fetch subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchSubscriptions(1, searchTerm, statusFilter)
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    fetchSubscriptions(newPage, searchTerm, statusFilter)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchSubscriptions(1, searchTerm, status)
  }

  const handleUpdateStatus = async (subscriptionId: string, newStatus: string) => {
    setActionLoading(subscriptionId)
    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (data.success) {
        setSubscriptions(subscriptions.map(sub => 
          sub._id === subscriptionId ? { ...sub, status: newStatus as any } : sub
        ))
        setSuccess(`Subscription status updated to ${newStatus}`)
        setShowDetailModal(false)
      } else {
        setError(data.error || 'Failed to update subscription')
      }
    } catch (error) {
      setError('Failed to update subscription')
    } finally {
      setActionLoading(null)
    }
  }

  const openDetailModal = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setShowDetailModal(true)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'expired':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'lifetime':
        return 'bg-purple-100 text-purple-800'
      case 'yearly':
        return 'bg-blue-100 text-blue-800'
      case 'monthly':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount)
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
            <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
            <p className="mt-2 text-gray-600">
              Manage user subscriptions and payment statuses
            </p>
          </div>
        </div>

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

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search by user email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" variant="gradient">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </Button>
            {(searchTerm || statusFilter) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('')
                  fetchSubscriptions(1, '', '')
                }}
              >
                Clear
              </Button>
            )}
          </form>

          {/* Status Filter Tabs */}
          <div className="flex space-x-2">
            <button
              onClick={() => handleStatusFilter('')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                !statusFilter 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              All Subscriptions
            </button>
            {['pending', 'active', 'cancelled', 'expired'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                  statusFilter === status 
                    ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>
              {pagination.total > 0 && 
                `Showing ${((pagination.page - 1) * pagination.limit) + 1} to ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} subscriptions`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="text-gray-500">Loading subscriptions...</div>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500">No subscriptions found</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3">User</th>
                      <th scope="col" className="px-6 py-3">Type</th>
                      <th scope="col" className="px-6 py-3">Amount</th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3">Start Date</th>
                      <th scope="col" className="px-6 py-3">End Date</th>
                      <th scope="col" className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr key={subscription._id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {subscription.userEmail}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getTypeBadgeColor(subscription.type)}`}>
                            {subscription.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {formatCurrency(subscription.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadgeColor(subscription.status)}`}>
                            {subscription.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {formatDate(subscription.startDate)}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {subscription.endDate ? formatDate(subscription.endDate) : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetailModal(subscription)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
        </div>
        </>
        )}
      </main>

      {/* Subscription Detail Modal */}
      {showDetailModal && selectedSubscription && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title="Subscription Details"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Email
                </label>
                <p className="text-sm text-gray-900">{selectedSubscription.userEmail}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscription Type
                </label>
                <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getTypeBadgeColor(selectedSubscription.type)}`}>
                  {selectedSubscription.type}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <p className="text-sm text-gray-900">{formatCurrency(selectedSubscription.amount)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadgeColor(selectedSubscription.status)}`}>
                  {selectedSubscription.status}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PayOS Order ID
                </label>
                <p className="text-sm text-gray-900 font-mono">{selectedSubscription.payosOrderId}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PayOS Transaction ID
                </label>
                <p className="text-sm text-gray-900 font-mono">
                  {selectedSubscription.payosTransactionId || 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <p className="text-sm text-gray-900">{formatDate(selectedSubscription.startDate)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <p className="text-sm text-gray-900">
                  {selectedSubscription.endDate ? formatDate(selectedSubscription.endDate) : 'Lifetime'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Created At
                </label>
                <p className="text-sm text-gray-900">{formatDate(selectedSubscription.createdAt)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Updated At
                </label>
                <p className="text-sm text-gray-900">{formatDate(selectedSubscription.updatedAt)}</p>
              </div>
            </div>

            {/* Status Update Actions */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Update Status
              </label>
              <div className="flex gap-2">
                {['active', 'cancelled', 'expired'].map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    disabled={selectedSubscription.status === status || actionLoading === selectedSubscription._id}
                    onClick={() => handleUpdateStatus(selectedSubscription._id, status)}
                    className={`capitalize ${
                      selectedSubscription.status === status 
                        ? 'opacity-50 cursor-not-allowed' 
                        : ''
                    }`}
                  >
                    {actionLoading === selectedSubscription._id ? 'Updating...' : `Mark as ${status}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
} 