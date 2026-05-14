'use client';

import { useMemo, useReducer, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { Button } from '@/components/ui/Button';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { ModalActions } from '@/components/ui/ModalActions';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineCheck, HiOutlineSearch } from '@/components/icons';
import { fetchApiData } from '@/lib/api/client';

const vndCurrencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

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

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
type AdminUsersModal = 'delete' | 'role' | 'subscription' | null;

interface AdminUsersState {
  actionLoading: string | null;
  localError: string;
  success: string;
  searchTerm: string;
  page: number;
  activeModal: AdminUsersModal;
  selectedUser: User | null;
  newRole: 'admin' | 'user';
  selectedPlanId: string;
  subscriptionDuration: number;
}

type AdminUsersAction =
  | { type: 'patch'; value: Partial<AdminUsersState> }
  | { type: 'setPage'; value: number }
  | { type: 'setSearchTerm'; value: string }
  | { type: 'resetSearch' }
  | { type: 'openRoleModal'; user: User }
  | { type: 'openDeleteModal'; user: User }
  | { type: 'openSubscriptionModal'; user: User }
  | { type: 'closeModal' }
  | { type: 'setSelectedPlan'; planId: string; duration: number };

const initialState: AdminUsersState = {
  actionLoading: null,
  localError: '',
  success: '',
  searchTerm: '',
  page: 1,
  activeModal: null,
  selectedUser: null,
  newRole: 'user',
  selectedPlanId: '',
  subscriptionDuration: 180,
};

function adminUsersReducer(state: AdminUsersState, action: AdminUsersAction): AdminUsersState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'setPage':
      return { ...state, page: action.value };
    case 'setSearchTerm':
      return { ...state, searchTerm: action.value };
    case 'resetSearch':
      return { ...state, searchTerm: '', page: 1 };
    case 'openRoleModal':
      return {
        ...state,
        selectedUser: action.user,
        newRole: action.user.role === 'admin' ? 'user' : 'admin',
        activeModal: 'role',
      };
    case 'openDeleteModal':
      return {
        ...state,
        selectedUser: action.user,
        activeModal: 'delete',
      };
    case 'openSubscriptionModal':
      return {
        ...state,
        selectedUser: action.user,
        activeModal: 'subscription',
        selectedPlanId: '',
        subscriptionDuration: 180,
      };
    case 'closeModal':
      return {
        ...state,
        activeModal: null,
        selectedUser: null,
        actionLoading: null,
      };
    case 'setSelectedPlan':
      return {
        ...state,
        selectedPlanId: action.planId,
        subscriptionDuration: action.duration,
      };
    default:
      return state;
  }
}

function formatCurrency(amount: number) {
  return vndCurrencyFormatter.format(amount);
}

function getRoleBadge(role: string, label: string) {
  return role === 'admin' ? (
    <Badge variant="warning">{label}</Badge>
  ) : (
    <Badge variant="success">{label}</Badge>
  );
}

function getSubscriptionText(subscription: User['subscription'] | undefined, t: TranslateFn) {
  if (!subscription) return t('noSubscription');
  if (!subscription.isActive) return t('inactive');
  if (subscription.type === 'lifetime') return t('lifetime');
  return t('active');
}

function getSubscriptionBadge(subscription: User['subscription'] | undefined, text: string) {
  if (!subscription) return <Badge variant="default">{text}</Badge>;
  if (!subscription.isActive) return <Badge variant="danger">{text}</Badge>;
  if (subscription.type === 'lifetime') return <Badge variant="warning">{text}</Badge>;
  return <Badge variant="success">{text}</Badge>;
}

function formatDate(dateString?: string) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
}

function HydratedDateText({ dateString }: { dateString?: string }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const label = mounted ? formatDate(dateString) : 'N/A';

  return (
    <time dateTime={dateString} suppressHydrationWarning>
      {label}
    </time>
  );
}

function UsersPageHeader({ t }: { t: TranslateFn }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">{t('userManagement')}</h1>
        <p className="mt-2 text-neutral-600">{t('manageUserAccounts')}</p>
      </div>
    </div>
  );
}

function UsersSearchBar({
  searchTerm,
  onSearchTermChange,
  onSubmit,
  onClear,
  t,
  tCommon,
}: {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClear: () => void;
  t: TranslateFn;
  tCommon: TranslateFn;
}) {
  return (
    <div className="mb-6">
      <form onSubmit={onSubmit} className="flex gap-4">
        <div className="max-w-md flex-1">
          <Input
            type="text"
            placeholder={t('searchUsers')}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            className="w-full"
          />
        </div>
        <Button type="submit" variant="gradient">
          <HiOutlineSearch className="mr-2 size-4" />
          {t('search')}
        </Button>
        {searchTerm ? (
          <Button type="button" variant="outline" onClick={onClear}>
            {tCommon('clear')}
          </Button>
        ) : null}
      </form>
    </div>
  );
}

function UsersStatsCards({
  users,
  pagination,
  t,
}: {
  users: User[];
  pagination: PaginationData;
  t: TranslateFn;
}) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card>
        <CardContent className="p-6">
          <div className="text-2xl font-bold text-neutral-900">{pagination.total}</div>
          <p className="text-neutral-600">{t('totalUsers')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="text-2xl font-bold text-brand-action">
            {users.filter((user) => user.role === 'admin').length}
          </div>
          <p className="text-neutral-600">{t('administratorsCurrentPage')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="text-2xl font-bold text-brand-trust">
            {users.filter((user) => user.role === 'user').length}
          </div>
          <p className="text-neutral-600">{t('regularUsersCurrentPage')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersResultsInfo({
  users,
  pagination,
  searchTerm,
  t,
}: {
  users: User[];
  pagination: PaginationData;
  searchTerm: string;
  t: TranslateFn;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <p className="text-neutral-600">
        {t('showingUsers', { count: users.length, total: pagination.total })}
        {searchTerm ? <span className="ml-2">{t('matching', { term: searchTerm })}</span> : null}
      </p>
      <p className="text-sm text-neutral-500">
        {t('page')} {pagination.page} {t('of')} {pagination.totalPages}
      </p>
    </div>
  );
}

function UserRow({
  user,
  sessionEmail,
  actionLoading,
  t,
  onOpenSubscriptionModal,
  onOpenRoleModal,
  onOpenDeleteModal,
}: {
  user: User;
  sessionEmail?: string | null;
  actionLoading: string | null;
  t: TranslateFn;
  onOpenSubscriptionModal: (user: User) => void;
  onOpenRoleModal: (user: User) => void;
  onOpenDeleteModal: (user: User) => void;
}) {
  const subscriptionText = getSubscriptionText(user.subscription, t);

  return (
    <tr className="hover:bg-neutral-50">
      <td className="whitespace-nowrap px-6 py-4">
        <div className="text-sm font-medium text-neutral-900">
          {user.email}
          {user.email === sessionEmail ? (
            <span className="ml-2 inline-flex min-h-[28px] items-center rounded-full bg-neutral-100 px-3 text-[13px] font-medium text-neutral-600">
              {t('you')}
            </span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        {getRoleBadge(user.role, user.role === 'admin' ? t('administrator') : t('user'))}
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <div className="flex items-center gap-x-2">
          {getSubscriptionBadge(user.subscription, subscriptionText)}
          {user.subscription?.startDate ? (
            <span className="text-sm text-neutral-500">
              <HydratedDateText dateString={user.subscription.startDate} />
            </span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-500">
        <HydratedDateText dateString={user.createdAt} />
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
        <div className="flex justify-end gap-x-2">
          {user.email !== sessionEmail ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenSubscriptionModal(user)}
                disabled={actionLoading === user._id}
                className="min-h-[40px] border-green-300 px-3 text-green-600 hover:bg-green-50"
              >
                {t('addSubscription')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenRoleModal(user)}
                disabled={actionLoading === user._id}
                className="min-h-[40px] px-3"
              >
                {user.role === 'admin' ? t('makeUser') : t('makeAdmin')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDeleteModal(user)}
                disabled={actionLoading === user._id}
                className="min-h-[40px] border-red-300 px-3 text-red-600 hover:bg-red-50"
              >
                {t('delete')}
              </Button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function UsersTable({
  users,
  sessionEmail,
  actionLoading,
  searchTerm,
  t,
  onOpenSubscriptionModal,
  onOpenRoleModal,
  onOpenDeleteModal,
}: {
  users: User[];
  sessionEmail?: string | null;
  actionLoading: string | null;
  searchTerm: string;
  t: TranslateFn;
  onOpenSubscriptionModal: (user: User) => void;
  onOpenRoleModal: (user: User) => void;
  onOpenDeleteModal: (user: User) => void;
}) {
  return (
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
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {t('user')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {t('role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {t('subscription')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {t('created')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {users.map((user) => (
                <UserRow
                  key={user._id}
                  user={user}
                  sessionEmail={sessionEmail}
                  actionLoading={actionLoading}
                  t={t}
                  onOpenSubscriptionModal={onOpenSubscriptionModal}
                  onOpenRoleModal={onOpenRoleModal}
                  onOpenDeleteModal={onOpenDeleteModal}
                />
              ))}
            </tbody>
          </table>

          {users.length === 0 ? (
            <EmptyState
              title={searchTerm ? t('noUsersMatching', { term: searchTerm }) : t('noUsersFound')}
              className="py-8"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function RoleModal({
  isOpen,
  selectedUser,
  newRole,
  actionLoading,
  onClose,
  onConfirm,
  t,
}: {
  isOpen: boolean;
  selectedUser: User | null;
  newRole: 'admin' | 'user';
  actionLoading: string | null;
  onClose: () => void;
  onConfirm: () => void;
  t: TranslateFn;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('changeUserRole')}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          {t('changeRoleConfirm', { email: selectedUser?.email || '', role: newRole || '' })}
        </p>

        <ModalActions
          cancelText={t('cancel')}
          confirmText={t('changeRole')}
          onCancel={onClose}
          onConfirm={onConfirm}
          isLoading={actionLoading === selectedUser?._id}
        />
      </div>
    </Modal>
  );
}

function DeleteUserModal({
  isOpen,
  selectedUser,
  actionLoading,
  onClose,
  onConfirm,
  t,
}: {
  isOpen: boolean;
  selectedUser: User | null;
  actionLoading: string | null;
  onClose: () => void;
  onConfirm: () => void;
  t: TranslateFn;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('deleteUser')}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          {t('deleteUserConfirm', { email: selectedUser?.email || '' })}
        </p>

        <ModalActions
          cancelText={t('cancel')}
          confirmText={t('deleteUserButton')}
          onCancel={onClose}
          onConfirm={onConfirm}
          isLoading={actionLoading === selectedUser?._id}
          confirmVariant="destructive"
        />
      </div>
    </Modal>
  );
}

function SubscriptionPlanButton({
  plan,
  selectedPlanId,
  onSelect,
}: {
  plan: Plan;
  selectedPlanId: string;
  onSelect: (plan: Plan) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={`min-h-[72px] w-full justify-start rounded-lg border p-4 transition-colors ${
        selectedPlanId === plan._id
          ? 'border-green-500 bg-green-50'
          : 'border-neutral-200 hover:border-neutral-300'
      }`}
      onClick={() => onSelect(plan)}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-neutral-900">{plan.name}</h3>
          <p className="text-sm text-neutral-600">{formatCurrency(plan.price)}</p>
          <p className="text-sm text-neutral-500">{plan.duration}</p>
        </div>
        {selectedPlanId === plan._id ? (
          <div className="text-brand-trust">
            <HiOutlineCheck className="size-5" />
          </div>
        ) : null}
      </div>
    </Button>
  );
}

function SelectedPlanDetails({ plan, t }: { plan: Plan; t: TranslateFn }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-4">
      <h4 className="mb-2 font-medium text-neutral-900">{t('selectedPlanDetails')}</h4>
      <div className="text-sm text-neutral-600">
        <p>
          <strong>{t('plan')}</strong> {plan.name}
        </p>
        <p>
          <strong>{t('price')}</strong> {formatCurrency(plan.price)}
        </p>
        <p>
          <strong>{t('duration')}</strong> {plan.duration}
        </p>
        <p>
          <strong>{t('features')}</strong>
        </p>
        <ul className="ml-2 list-inside list-disc">
          {plan.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SubscriptionModal({
  isOpen,
  selectedUser,
  plans,
  selectedPlanId,
  actionLoading,
  onClose,
  onConfirm,
  onSelectPlan,
  t,
}: {
  isOpen: boolean;
  selectedUser: User | null;
  plans: Plan[];
  selectedPlanId: string;
  actionLoading: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onSelectPlan: (plan: Plan) => void;
  t: TranslateFn;
}) {
  const selectedPlan = plans.find((plan) => plan._id === selectedPlanId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('addSubscriptionTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          {t('selectPlan', { email: selectedUser?.email || '' })}
        </p>

        <div className="space-y-3">
          {plans.map((plan) => (
            <SubscriptionPlanButton
              key={plan._id}
              plan={plan}
              selectedPlanId={selectedPlanId}
              onSelect={onSelectPlan}
            />
          ))}
        </div>

        {selectedPlan ? <SelectedPlanDetails plan={selectedPlan} t={t} /> : null}

        <ModalActions
          cancelText={t('cancel')}
          confirmText={t('addSubscriptionButton')}
          onCancel={onClose}
          onConfirm={onConfirm}
          isLoading={actionLoading === selectedUser?._id}
          isDisabled={!selectedPlanId}
        />
      </div>
    </Modal>
  );
}

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { data: session } = useSession();
  const [state, dispatch] = useReducer(adminUsersReducer, initialState);
  const limit = 10;

  const swrKey = useMemo(() => {
    const params = new URLSearchParams({
      page: state.page.toString(),
      limit: limit.toString(),
    });

    if (state.searchTerm.trim()) {
      params.append('search', state.searchTerm.trim());
    }

    return `/api/admin/users?${params}`;
  }, [limit, state.page, state.searchTerm]);

  const {
    data: usersData,
    error: usersError,
    isLoading: usersLoading,
    mutate: mutateUsers,
  } = useSWR(swrKey, fetchApiData<{ users: User[]; pagination: PaginationData }>);

  const { data: plansData } = useSWR('/api/admin/plans', fetchApiData<Plan[]>);

  const users = usersData?.users ?? [];
  const plans = plansData ?? [];
  const pagination = usersData?.pagination ?? { page: state.page, limit, total: 0, totalPages: 0 };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'setPage', value: 1 });
  };

  const runUserAction = async (
    userId: string,
    request: () => Promise<void>,
    successMessage: string,
  ) => {
    dispatch({ type: 'patch', value: { actionLoading: userId, localError: '', success: '' } });

    try {
      await request();
      mutateUsers();
      dispatch({
        type: 'patch',
        value: {
          actionLoading: null,
          success: successMessage,
          localError: '',
        },
      });
      dispatch({ type: 'closeModal' });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          actionLoading: null,
          localError: error instanceof Error ? error.message : 'Request failed',
        },
      });
    }
  };

  const handleChangeRole = async () => {
    if (!state.selectedUser) return;

    await runUserAction(
      state.selectedUser._id,
      () =>
        fetchApiData('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: state.selectedUser?._id,
            role: state.newRole,
          }),
        }),
      `User role updated to ${state.newRole}`,
    );
  };

  const handleDeleteUser = async () => {
    if (!state.selectedUser) return;

    await runUserAction(
      state.selectedUser._id,
      () =>
        fetchApiData(`/api/admin/users?userId=${state.selectedUser?._id}`, {
          method: 'DELETE',
        }),
      'User deleted successfully',
    );
  };

  const handleAddSubscription = async () => {
    if (!state.selectedUser || !state.selectedPlanId) return;

    await runUserAction(
      state.selectedUser._id,
      () =>
        fetchApiData('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: state.selectedUser?._id,
            planId: state.selectedPlanId,
            duration: state.subscriptionDuration,
          }),
        }),
      `Subscription added successfully for ${state.selectedUser.email}`,
    );
  };

  if (usersLoading) {
    return (
      <AdminPageShell>
        <LoadingState text={tCommon('loading')} />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <div className="mx-auto max-w-6xl">
        <UsersPageHeader t={t} />

        <UsersSearchBar
          searchTerm={state.searchTerm}
          onSearchTermChange={(value) => dispatch({ type: 'setSearchTerm', value })}
          onSubmit={handleSearch}
          onClear={() => dispatch({ type: 'resetSearch' })}
          t={t}
          tCommon={tCommon}
        />

        {usersError || state.localError ? (
          <ErrorState message={usersError?.message || state.localError || ''} className="mb-6" />
        ) : null}

        {state.success ? (
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{state.success}</div>
          </div>
        ) : null}

        <UsersStatsCards users={users} pagination={pagination} t={t} />

        <UsersResultsInfo
          users={users}
          pagination={pagination}
          searchTerm={state.searchTerm}
          t={t}
        />

        <UsersTable
          users={users}
          sessionEmail={session?.user?.email}
          actionLoading={state.actionLoading}
          searchTerm={state.searchTerm}
          t={t}
          onOpenSubscriptionModal={(user) => dispatch({ type: 'openSubscriptionModal', user })}
          onOpenRoleModal={(user) => dispatch({ type: 'openRoleModal', user })}
          onOpenDeleteModal={(user) => dispatch({ type: 'openDeleteModal', user })}
        />

        {pagination.totalPages > 1 ? (
          <div className="mt-8">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(newPage) => dispatch({ type: 'setPage', value: newPage })}
              className="justify-center"
            />
          </div>
        ) : null}
      </div>

      <RoleModal
        isOpen={state.activeModal === 'role'}
        selectedUser={state.selectedUser}
        newRole={state.newRole}
        actionLoading={state.actionLoading}
        onClose={() => dispatch({ type: 'closeModal' })}
        onConfirm={() => void handleChangeRole()}
        t={t}
      />

      <DeleteUserModal
        isOpen={state.activeModal === 'delete'}
        selectedUser={state.selectedUser}
        actionLoading={state.actionLoading}
        onClose={() => dispatch({ type: 'closeModal' })}
        onConfirm={() => void handleDeleteUser()}
        t={t}
      />

      <SubscriptionModal
        isOpen={state.activeModal === 'subscription'}
        selectedUser={state.selectedUser}
        plans={plans}
        selectedPlanId={state.selectedPlanId}
        actionLoading={state.actionLoading}
        onClose={() => dispatch({ type: 'closeModal' })}
        onConfirm={() => void handleAddSubscription()}
        onSelectPlan={(plan) =>
          dispatch({
            type: 'setSelectedPlan',
            planId: plan._id,
            duration: plan.duration === 'lifetime' ? 0 : plan.duration === 'monthly' ? 30 : 180,
          })
        }
        t={t}
      />
    </AdminPageShell>
  );
}
