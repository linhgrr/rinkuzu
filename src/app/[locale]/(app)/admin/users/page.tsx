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
import { HiOutlineSearch, HiOutlineCheck } from '@/components/icons';
import Navigation from '@/components/Navigation';

interface User {
  _id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  subscription?: {
    type: string;
    startDate?: string;
    endDate?: string;
    isActive: boolean;
  };
}

interface Plan {
  _id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [subscriptionDuration, setSubscriptionDuration] = useState(180); // Default 6 months

  const fetchUsers = useCallback(
    async (page: number = 1, search: string = '') => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
        });

        if (search.trim()) {
          params.append('search', search.trim());
        }

        const response = await fetch(`/api/admin/users?${params}`);
        const data = await response.json();

        if (data.success) {
          setUsers(data.data.users);
          setPagination({
            page: data.data.pagination.currentPage,
            limit: data.data.pagination.itemsPerPage,
            total: data.data.pagination.totalItems,
            totalPages: data.data.pagination.totalPages,
          });
          setError('');
        } else {
          setError(data.error || 'Failed to fetch users');
        }
      } catch (_error) {
        setError('Failed to fetch users');
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit],
  );

  const fetchPlans = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/plans');
      const data = await response.json();

      if (data.success) {
        setPlans(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchPlans();
  }, [fetchUsers, fetchPlans]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchUsers(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchUsers(newPage, searchTerm);
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    setActionLoading(selectedUser._id);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser._id,
          role: newRole,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUsers(
          users.map((user) => (user._id === selectedUser._id ? { ...user, role: newRole } : user)),
        );
        setSuccess(`User role updated to ${newRole}`);
        setShowRoleModal(false);
        setSelectedUser(null);
      } else {
        setError(data.error || 'Failed to update user role');
      }
    } catch (_error) {
      setError('Failed to update user role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading(selectedUser._id);
    try {
      const response = await fetch(`/api/admin/users?userId=${selectedUser._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setUsers(users.filter((user) => user._id !== selectedUser._id));
        setSuccess('User deleted successfully');
        setShowDeleteModal(false);
        setSelectedUser(null);
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (_error) {
      setError('Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSubscription = async () => {
    if (!selectedUser || !selectedPlanId) return;

    setActionLoading(selectedUser._id);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser._id,
          planId: selectedPlanId,
          duration: subscriptionDuration,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update user in the list with new subscription
        setUsers(
          users.map((user) =>
            user._id === selectedUser._id
              ? {
                  ...user,
                  subscription: {
                    type: selectedPlanId,
                    startDate: new Date().toISOString(),
                    endDate: data.data.endDate,
                    isActive: true,
                  },
                }
              : user,
          ),
        );
        setSuccess(`Subscription added successfully for ${selectedUser.email}`);
        setShowSubscriptionModal(false);
        setSelectedUser(null);
        setSelectedPlanId('');
        setSubscriptionDuration(180);
      } else {
        setError(data.error || 'Failed to add subscription');
      }
    } catch (_error) {
      setError('Failed to add subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role === 'admin' ? 'user' : 'admin');
    setShowRoleModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const openSubscriptionModal = (user: User) => {
    setSelectedUser(user);
    setSelectedPlanId('');
    setSubscriptionDuration(180);
    setShowSubscriptionModal(true);
  };

  const getRoleBadge = (role: string, label: string) => {
    return role === 'admin' ? (
      <Badge variant="warning">{label}</Badge>
    ) : (
      <Badge variant="success">{label}</Badge>
    );
  };

  const getSubscriptionBadge = (subscription?: User['subscription'], text?: string) => {
    if (!subscription) return <Badge variant="default">{text}</Badge>;
    if (!subscription.isActive) return <Badge variant="danger">{text}</Badge>;
    if (subscription.type === 'lifetime') return <Badge variant="warning">{text}</Badge>;
    return <Badge variant="success">{text}</Badge>;
  };

  const getSubscriptionText = (subscription?: User['subscription']) => {
    if (!subscription) return t('noSubscription');
    if (!subscription.isActive) return t('inactive');
    if (subscription.type === 'lifetime') return t('lifetime');
    return t('active');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
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
        className={`py-8 transition-[margin] duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} max-w-none px-4 sm:px-6 lg:px-8`}
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
                <h1 className="text-3xl font-bold text-neutral-900">{t('userManagement')}</h1>
                <p className="mt-2 text-neutral-600">{t('manageUserAccounts')}</p>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <form onSubmit={handleSearch} className="flex gap-4">
                <div className="flex-1 max-w-md">
                  <Input
                    type="text"
                    placeholder={t('searchUsers')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button type="submit" variant="gradient">
                  <HiOutlineSearch className="w-4 h-4 mr-2" />
                  {t('search')}
                </Button>
                {searchTerm && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      fetchUsers(1, '');
                    }}
                  >
                    {tCommon('clear')}
                  </Button>
                )}
              </form>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 mb-6">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-4 mb-6">
                <div className="text-sm text-green-700">{success}</div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-neutral-900">{pagination.total}</div>
                  <p className="text-neutral-600">{t('totalUsers')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-brand-action">
                    {users.filter((u) => u.role === 'admin').length}
                  </div>
                  <p className="text-neutral-600">{t('administratorsCurrentPage')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-brand-trust">
                    {users.filter((u) => u.role === 'user').length}
                  </div>
                  <p className="text-neutral-600">{t('regularUsersCurrentPage')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-neutral-600">
                {t('showingUsers', { count: users.length, total: pagination.total })}
                {searchTerm && <span className="ml-2">{t('matching', { term: searchTerm })}</span>}
              </p>
              <p className="text-sm text-neutral-500">
                {t('page')} {pagination.page} {t('of')} {pagination.totalPages}
              </p>
            </div>

            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle>{t('allUsers')}</CardTitle>
                <CardDescription>{t('manageUserRoles')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          {t('user')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          {t('role')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          {t('subscription')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          {t('created')}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          {t('actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {users.map((user) => (
                        <tr key={user._id} className="hover:bg-neutral-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-neutral-900">
                              {user.email}
                              {user.email === session?.user?.email && (
                                <span className="ml-2 text-xs text-neutral-500">{t('you')}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getRoleBadge(
                              user.role,
                              user.role === 'admin' ? t('administrator') : t('user'),
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {getSubscriptionBadge(
                                user.subscription,
                                getSubscriptionText(user.subscription),
                              )}
                              {user.subscription?.startDate && (
                                <span className="text-xs text-neutral-500">
                                  {formatDate(user.subscription.startDate)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              {user.email !== session?.user?.email && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openSubscriptionModal(user)}
                                    disabled={actionLoading === user._id}
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                  >
                                    {t('addSubscription')}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openRoleModal(user)}
                                    disabled={actionLoading === user._id}
                                  >
                                    {user.role === 'admin' ? t('makeUser') : t('makeAdmin')}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openDeleteModal(user)}
                                    disabled={actionLoading === user._id}
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                  >
                                    {t('delete')}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {users.length === 0 && (
                    <div className="text-center py-8 text-neutral-500">
                      {searchTerm ? t('noUsersMatching', { term: searchTerm }) : t('noUsersFound')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                  className="justify-center"
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Change Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={t('changeUserRole')}
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {t('changeRoleConfirm', { email: selectedUser?.email || '', role: newRole || '' })}
          </p>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowRoleModal(false)}
              disabled={actionLoading === selectedUser?._id}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleChangeRole} loading={actionLoading === selectedUser?._id}>
              {t('changeRole')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('deleteUser')}
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {t('deleteUserConfirm', { email: selectedUser?.email || '' })}
          </p>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={actionLoading === selectedUser?._id}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleDeleteUser}
              loading={actionLoading === selectedUser?._id}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('deleteUserButton')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Subscription Modal */}
      <Modal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        title={t('addSubscriptionTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {t('selectPlan', { email: selectedUser?.email || '' })}
          </p>

          <div className="space-y-3">
            {plans.map((plan) => (
              <Button
                key={plan._id}
                type="button"
                variant="ghost"
                className={`h-auto w-full justify-start rounded-lg border p-4 transition-colors ${
                  selectedPlanId === plan._id
                    ? 'border-green-500 bg-green-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
                onClick={() => {
                  setSelectedPlanId(plan._id);
                  setSubscriptionDuration(
                    plan.duration === 'lifetime' ? 0 : plan.duration === 'monthly' ? 30 : 180,
                  );
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-neutral-900">{plan.name}</h3>
                    <p className="text-sm text-neutral-600">{formatCurrency(plan.price)}</p>
                    <p className="text-xs text-neutral-500">{plan.duration}</p>
                  </div>
                  {selectedPlanId === plan._id && (
                    <div className="text-brand-trust">
                      <HiOutlineCheck className="w-5 h-5" />
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>

          {selectedPlanId && (
            <div className="p-4 bg-neutral-50 rounded-lg">
              <h4 className="font-medium text-neutral-900 mb-2">{t('selectedPlanDetails')}</h4>
              {plans.find((p) => p._id === selectedPlanId) && (
                <div className="text-sm text-neutral-600">
                  <p>
                    <strong>{t('plan')}</strong> {plans.find((p) => p._id === selectedPlanId)?.name}
                  </p>
                  <p>
                    <strong>{t('price')}</strong>{' '}
                    {formatCurrency(plans.find((p) => p._id === selectedPlanId)?.price || 0)}
                  </p>
                  <p>
                    <strong>{t('duration')}</strong>{' '}
                    {plans.find((p) => p._id === selectedPlanId)?.duration}
                  </p>
                  <p>
                    <strong>{t('features')}</strong>
                  </p>
                  <ul className="list-disc list-inside ml-2">
                    {plans
                      .find((p) => p._id === selectedPlanId)
                      ?.features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowSubscriptionModal(false)}
              disabled={actionLoading === selectedUser?._id}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleAddSubscription}
              loading={actionLoading === selectedUser?._id}
              disabled={!selectedPlanId}
            >
              {t('addSubscriptionButton')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
