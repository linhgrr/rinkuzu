'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import Sidebar from '@/components/Sidebar';
import { HiOutlineSearch, HiOutlineEye } from '@/components/icons';
import Navigation from '@/components/Navigation';

interface Subscription {
  _id: string;
  userEmail: string;
  user: string;
  type: 'monthly' | 'yearly' | 'lifetime';
  amount: number;
  status: 'pending' | 'active' | 'cancelled' | 'expired';
  payosOrderId: string;
  payosTransactionId?: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminSubscriptionsPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { data: _session } = useSession();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  const fetchSubscriptions = useCallback(
    async (page: number = 1, search: string = '', status: string = '') => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
        });

        if (search.trim()) {
          params.append('search', search.trim());
        }

        if (status) {
          params.append('status', status);
        }

        const response = await fetch(`/api/admin/subscriptions?${params}`, {
          cache: 'no-store', // hoặc 'reload'
        });

        const data = await response.json();

        if (data.success) {
          setSubscriptions(data.data.subscriptions);
          setPagination({
            page: data.data.pagination.currentPage,
            limit: data.data.pagination.itemsPerPage,
            total: data.data.pagination.totalItems,
            totalPages: data.data.pagination.totalPages,
          });
          setError('');
        } else {
          setError(data.error || 'Failed to fetch subscriptions');
        }
      } catch (_error) {
        setError('Failed to fetch subscriptions');
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit],
  );

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchSubscriptions(1, searchTerm, statusFilter);
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchSubscriptions(newPage, searchTerm, statusFilter);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchSubscriptions(1, searchTerm, status);
  };

  const handleUpdateStatus = async (subscriptionId: string, newStatus: string) => {
    setActionLoading(subscriptionId);
    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        setSubscriptions(
          subscriptions.map((sub) =>
            sub._id === subscriptionId ? { ...sub, status: newStatus as any } : sub,
          ),
        );
        setSuccess(`Subscription status updated to ${newStatus}`);
        setShowDetailModal(false);
      } else {
        setError(data.error || 'Failed to update subscription');
      }
    } catch (_error) {
      setError('Failed to update subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const openDetailModal = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setShowDetailModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">{status}</Badge>;
      case 'pending':
        return <Badge variant="warning">{status}</Badge>;
      case 'cancelled':
        return <Badge variant="danger">{status}</Badge>;
      case 'expired':
        return <Badge variant="default">{status}</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'lifetime':
        return <Badge variant="success">{type}</Badge>;
      case 'yearly':
        return <Badge variant="success">{type}</Badge>;
      case 'monthly':
        return <Badge variant="info">{type}</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main
        className={`py-8 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} max-w-none px-4 sm:px-6 lg:px-8`}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
              <div className="text-sm text-neutral-500">{tCommon('loading')}</div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-neutral-900">{t('subscriptions')}</h1>
                <p className="mt-2 text-neutral-600">
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
                  <HiOutlineSearch className="w-4 h-4 mr-2" />
                  {tCommon('search')}
                </Button>
                {(searchTerm || statusFilter) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                      fetchSubscriptions(1, '', '');
                    }}
                  >
                    {tCommon('clear')}
                  </Button>
                )}
              </form>

              {/* Status Filter Tabs */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleStatusFilter('')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    !statusFilter
                      ? 'bg-green-100 text-brand-trust border border-green-200'
                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
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
                        ? 'bg-green-100 text-brand-trust border border-green-200'
                        : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
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
                    `Showing ${(pagination.page - 1) * pagination.limit + 1} to ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} subscriptions`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
                      <div className="text-sm text-neutral-500">{t('loadingStatistics')}</div>
                    </div>
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-neutral-500">{t('noUsersFound')}</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-neutral-700 uppercase bg-neutral-50">
                        <tr>
                          <th scope="col" className="px-6 py-3">
                            User
                          </th>
                          <th scope="col" className="px-6 py-3">
                            Type
                          </th>
                          <th scope="col" className="px-6 py-3">
                            Amount
                          </th>
                          <th scope="col" className="px-6 py-3">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3">
                            Start Date
                          </th>
                          <th scope="col" className="px-6 py-3">
                            End Date
                          </th>
                          <th scope="col" className="px-6 py-3">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((subscription) => (
                          <tr
                            key={subscription._id}
                            className="bg-white border-b hover:bg-neutral-50"
                          >
                            <td className="px-6 py-4 font-medium text-neutral-900">
                              {subscription.userEmail}
                            </td>
                            <td className="px-6 py-4">{getTypeBadge(subscription.type)}</td>
                            <td className="px-6 py-4">{formatCurrency(subscription.amount)}</td>
                            <td className="px-6 py-4">{getStatusBadge(subscription.status)}</td>
                            <td className="px-6 py-4 text-neutral-500">
                              {formatDate(subscription.startDate)}
                            </td>
                            <td className="px-6 py-4 text-neutral-500">
                              {subscription.endDate ? formatDate(subscription.endDate) : 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetailModal(subscription)}
                                className="text-brand-trust hover:text-brand-trust"
                              >
                                <HiOutlineEye className="w-4 h-4 mr-1" /> View Details
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
                <p className="block text-sm font-medium text-neutral-700 mb-1">User Email</p>
                <p className="text-sm text-neutral-900">{selectedSubscription.userEmail}</p>
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">Subscription Type</p>
                {getTypeBadge(selectedSubscription.type)}
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">Amount</p>
                <p className="text-sm text-neutral-900">
                  {formatCurrency(selectedSubscription.amount)}
                </p>
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">Status</p>
                {getStatusBadge(selectedSubscription.status)}
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">PayOS Order ID</p>
                <p className="text-sm text-neutral-900 font-mono">
                  {selectedSubscription.payosOrderId}
                </p>
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">
                  PayOS Transaction ID
                </p>
                <p className="text-sm text-neutral-900 font-mono">
                  {selectedSubscription.payosTransactionId || 'N/A'}
                </p>
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">Start Date</p>
                <p className="text-sm text-neutral-900">
                  {formatDate(selectedSubscription.startDate)}
                </p>
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">End Date</p>
                <p className="text-sm text-neutral-900">
                  {selectedSubscription.endDate
                    ? formatDate(selectedSubscription.endDate)
                    : 'Lifetime'}
                </p>
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">Created At</p>
                <p className="text-sm text-neutral-900">
                  {formatDate(selectedSubscription.createdAt)}
                </p>
              </div>
              <div>
                <p className="block text-sm font-medium text-neutral-700 mb-1">Updated At</p>
                <p className="text-sm text-neutral-900">
                  {formatDate(selectedSubscription.updatedAt)}
                </p>
              </div>
            </div>

            {/* Status Update Actions */}
            <div className="border-t pt-4">
              <p className="block text-sm font-medium text-neutral-700 mb-3">Update Status</p>
              <div className="flex gap-2">
                {['active', 'cancelled', 'expired'].map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    disabled={
                      selectedSubscription.status === status ||
                      actionLoading === selectedSubscription._id
                    }
                    onClick={() => handleUpdateStatus(selectedSubscription._id, status)}
                    className={`capitalize ${
                      selectedSubscription.status === status ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {actionLoading === selectedSubscription._id ? 'Updating…' : `Mark as ${status}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
