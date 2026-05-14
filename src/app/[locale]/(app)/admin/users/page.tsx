'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
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
import { ModalActions } from '@/components/ui/ModalActions';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { HiOutlineSearch, HiOutlineCheck } from '@/components/icons';
import { fetchApiData } from '@/lib/api/client';

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

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // SWR hooks
  const swrParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (searchTerm.trim()) {
    swrParams.append('search', searchTerm.trim());
  }

  const {
    data: usersData,
    error: usersError,
    isLoading: usersLoading,
    mutate: mutateUsers,
  } = useSWR(
    `/api/admin/users?${swrParams}`,
    fetchApiData<{ users: User[]; pagination: PaginationData }>,
  );

  const { data: plansData } = useSWR('/api/admin/plans', fetchApiData<Plan[]>);

  const users = usersData?.users ?? [];
  const plans = plansData ?? [];
  const pagination = usersData?.pagination ?? { page, limit, total: 0, totalPages: 0 };

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [subscriptionDuration, setSubscriptionDuration] = useState(180); // Default 6 months

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    setActionLoading(selectedUser._id);
    try {
      await fetchApiData('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser._id,
          role: newRole,
        }),
      });
      mutateUsers();
      setSuccess(`User role updated to ${newRole}`);
      setShowRoleModal(false);
      setSelectedUser(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to update user role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading(selectedUser._id);
    try {
      await fetchApiData(`/api/admin/users?userId=${selectedUser._id}`, {
        method: 'DELETE',
      });
      mutateUsers();
      setSuccess('User deleted successfully');
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSubscription = async () => {
    if (!selectedUser || !selectedPlanId) return;

    setActionLoading(selectedUser._id);
    try {
      await fetchApiData('/api/admin/users', {
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
      mutateUsers();
      setSuccess(`Subscription added successfully for ${selectedUser.email}`);
      setShowSubscriptionModal(false);
      setSelectedUser(null);
      setSelectedPlanId('');
      setSubscriptionDuration(180);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to add subscription');
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
    <AdminPageShell>
      {usersLoading ? (
        <LoadingState text={tCommon('loading')} />
      ) : (
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-neutral-900">{t('userManagement')}</h1>
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
                <HiOutlineSearch className="size-4 mr-2" />
                {t('search')}
              </Button>
              {searchTerm && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setPage(1);
                  }}
                >
                  {tCommon('clear')}
                </Button>
              )}
            </form>
          </div>

          {(usersError || localError) && (
            <ErrorState message={usersError?.message || localError || ''} className="mb-6" />
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
                              <span className="ml-2 inline-flex min-h-[28px] items-center rounded-full bg-neutral-100 px-3 text-[13px] font-medium text-neutral-600">
                                {t('you')}
                              </span>
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
                          <div className="flex items-center gap-x-2">
                            {getSubscriptionBadge(
                              user.subscription,
                              getSubscriptionText(user.subscription),
                            )}
                            {user.subscription?.startDate && (
                              <span className="text-sm text-neutral-500">
                                {formatDate(user.subscription.startDate)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500"
                          suppressHydrationWarning
                        >
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-x-2">
                            {user.email !== session?.user?.email && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openSubscriptionModal(user)}
                                  disabled={actionLoading === user._id}
                                  className="min-h-[40px] px-3 text-green-600 border-green-300 hover:bg-green-50"
                                >
                                  {t('addSubscription')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openRoleModal(user)}
                                  disabled={actionLoading === user._id}
                                  className="min-h-[40px] px-3"
                                >
                                  {user.role === 'admin' ? t('makeUser') : t('makeAdmin')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDeleteModal(user)}
                                  disabled={actionLoading === user._id}
                                  className="min-h-[40px] px-3 text-red-600 border-red-300 hover:bg-red-50"
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
                  <EmptyState
                    title={
                      searchTerm ? t('noUsersMatching', { term: searchTerm }) : t('noUsersFound')
                    }
                    className="py-8"
                  />
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

          <ModalActions
            cancelText={t('cancel')}
            confirmText={t('changeRole')}
            onCancel={() => setShowRoleModal(false)}
            onConfirm={handleChangeRole}
            isLoading={actionLoading === selectedUser?._id}
          />
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

          <ModalActions
            cancelText={t('cancel')}
            confirmText={t('deleteUserButton')}
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteUser}
            isLoading={actionLoading === selectedUser?._id}
            confirmVariant="destructive"
          />
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
                className={`min-h-[72px] w-full justify-start rounded-lg border p-4 transition-colors ${
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
                    <p className="text-sm text-neutral-500">{plan.duration}</p>
                  </div>
                  {selectedPlanId === plan._id && (
                    <div className="text-brand-trust">
                      <HiOutlineCheck className="size-5" />
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

          <ModalActions
            cancelText={t('cancel')}
            confirmText={t('addSubscriptionButton')}
            onCancel={() => setShowSubscriptionModal(false)}
            onConfirm={handleAddSubscription}
            isLoading={actionLoading === selectedUser?._id}
            isDisabled={!selectedPlanId}
          />
        </div>
      </Modal>
    </AdminPageShell>
  );
}
