'use client';

import { useReducer } from 'react';
import type { FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminUsersPageSkeleton } from '@/components/admin/AdminLoadingSkeletons';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
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
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { ModalActions } from '@/components/ui/ModalActions';
import Pagination from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HiOutlineCheck } from 'react-icons/hi';
import {
  fetchAdminUserListViewModel,
  grantAdminUserSubscription,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '@/features/admin/users/api/admin-users-api';
import type {
  AdminUserListViewModel,
  AdminUserStatusFilter,
  AdminUsersPaginationViewModel,
  AdminUserViewModel,
} from '@/features/admin/users/types/admin-users-view-model';
import { fetchAdminBillingPlanViewModels } from '@/features/admin/plans/api/admin-plans-api';
import type { AdminBillingPlanViewModel } from '@/features/admin/plans/types/admin-plans-view-model';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import type { UserRole } from '@/types/next-auth';
import {
  ACCOUNT_DISABLE_ACTIVE,
  ACCOUNT_DISABLE_DISABLED,
} from '@/shared/constants/account-disable';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
type AdminUsersModal = 'status' | 'role' | 'subscription' | null;
type AdminUserActionRequest<T> = () => Promise<T>;

interface AdminUsersTranslationProps {
  t: TranslateFn;
}

interface UsersSearchBarProps extends AdminUsersTranslationProps {
  searchTerm: string;
  statusFilter: AdminUserStatusFilter;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: AdminUserStatusFilter) => void;
  onSubmit: (event: FormEvent) => void;
  onClear: () => void;
  tCommon: TranslateFn;
}

interface UsersStatsCardsProps extends AdminUsersTranslationProps {
  users: AdminUserViewModel[];
  pagination: AdminUsersPaginationViewModel;
}

interface UsersResultsInfoProps extends UsersStatsCardsProps {
  searchTerm: string;
}

interface UserActionCallbacks {
  onOpenSubscriptionModal: (user: AdminUserViewModel) => void;
  onOpenRoleModal: (user: AdminUserViewModel) => void;
  onOpenStatusModal: (user: AdminUserViewModel) => void;
}

interface UserRowProps extends AdminUsersTranslationProps, UserActionCallbacks {
  user: AdminUserViewModel;
  sessionEmail?: string | null;
  actionLoading: string | null;
}

interface UsersTableProps extends AdminUsersTranslationProps, UserActionCallbacks {
  users: AdminUserViewModel[];
  sessionEmail?: string | null;
  actionLoading: string | null;
  searchTerm: string;
}

interface RoleModalProps extends AdminUsersTranslationProps {
  isOpen: boolean;
  selectedUser: AdminUserViewModel | null;
  newRole: UserRole;
  actionLoading: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

interface StatusUserModalProps extends AdminUsersTranslationProps {
  isOpen: boolean;
  selectedUser: AdminUserViewModel | null;
  actionLoading: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

interface SubscriptionPlanButtonProps {
  plan: AdminBillingPlanViewModel;
  selectedPlanId: string;
  onSelect: (plan: AdminBillingPlanViewModel) => void;
}

interface SelectedPlanDetailsProps extends AdminUsersTranslationProps {
  plan: AdminBillingPlanViewModel;
}

interface SubscriptionModalProps extends AdminUsersTranslationProps {
  isOpen: boolean;
  selectedUser: AdminUserViewModel | null;
  plans: AdminBillingPlanViewModel[];
  selectedPlanId: string;
  actionLoading: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onSelectPlan: (plan: AdminBillingPlanViewModel) => void;
}

interface AdminUsersState {
  actionLoading: string | null;
  localError: string;
  success: string;
  searchInput: string;
  searchTerm: string;
  statusFilter: AdminUserStatusFilter;
  page: number;
  activeModal: AdminUsersModal;
  selectedUser: AdminUserViewModel | null;
  newRole: UserRole;
  selectedPlanId: string;
}

type AdminUsersAction =
  | { type: 'patch'; value: Partial<AdminUsersState> }
  | { type: 'setPage'; value: number }
  | { type: 'setSearchInput'; value: string }
  | { type: 'setStatusFilter'; value: AdminUserStatusFilter }
  | { type: 'applySearch' }
  | { type: 'resetSearch' }
  | { type: 'openRoleModal'; user: AdminUserViewModel }
  | { type: 'openStatusModal'; user: AdminUserViewModel }
  | { type: 'openSubscriptionModal'; user: AdminUserViewModel }
  | { type: 'closeModal' }
  | { type: 'setSelectedPlan'; planId: string };

const STATUS_FILTER_DEFAULT: AdminUserStatusFilter = 'all';

const initialState: AdminUsersState = {
  actionLoading: null,
  localError: '',
  success: '',
  searchInput: '',
  searchTerm: '',
  statusFilter: STATUS_FILTER_DEFAULT,
  page: 1,
  activeModal: null,
  selectedUser: null,
  newRole: 'user',
  selectedPlanId: '',
};

function adminUsersReducer(state: AdminUsersState, action: AdminUsersAction): AdminUsersState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'setPage':
      return { ...state, page: action.value };
    case 'setSearchInput':
      return { ...state, searchInput: action.value };
    case 'setStatusFilter':
      return {
        ...state,
        statusFilter: action.value,
        page: 1,
      };
    case 'applySearch':
      return { ...state, searchTerm: state.searchInput.trim(), page: 1 };
    case 'resetSearch':
      return { ...state, searchInput: '', searchTerm: '', page: 1 };
    case 'openRoleModal':
      return {
        ...state,
        selectedUser: action.user,
        newRole: action.user.role === 'admin' ? 'user' : 'admin',
        activeModal: 'role',
      };
    case 'openStatusModal':
      return {
        ...state,
        selectedUser: action.user,
        activeModal: 'status',
      };
    case 'openSubscriptionModal':
      return {
        ...state,
        selectedUser: action.user,
        activeModal: 'subscription',
        selectedPlanId: '',
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
      };
    default: {
      // Exhaustive guard: unknown actions must not silently keep stale modal labels.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

function getRoleBadge(role: string, label: string) {
  return role === 'admin' ? (
    <Badge variant="warning">{label}</Badge>
  ) : (
    <Badge variant="success">{label}</Badge>
  );
}

function getSubscriptionBadge(user: AdminUserViewModel, t: TranslateFn) {
  const subscription = user.subscription;
  if (!subscription) return <Badge variant="default">{t('noSubscription')}</Badge>;
  return <Badge variant={subscription.statusVariant}>{t(subscription.statusLabel)}</Badge>;
}

function UsersSearchBar({
  searchTerm,
  statusFilter,
  onSearchTermChange,
  onStatusFilterChange,
  onSubmit,
  onClear,
  t,
  tCommon,
}: UsersSearchBarProps) {
  const statusOptions = [
    { value: 'all' as const, label: t('statusFilterAll') },
    { value: 'active' as const, label: t('statusFilterActive') },
    { value: 'disabled' as const, label: t('statusFilterDisabled') },
  ];

  return (
    <div className="mb-6">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-4">
        <div className="max-w-md min-w-[200px] flex-1">
          <AdminSearchInput
            placeholder={t('searchUsers')}
            value={searchTerm}
            onChange={onSearchTermChange}
            className="w-full"
          />
        </div>
        <SegmentedControl
          ariaLabel={t('accountStatus')}
          value={statusFilter}
          options={statusOptions}
          onChange={onStatusFilterChange}
        />
        {searchTerm ? (
          <Button type="button" variant="outline" onClick={onClear}>
            {tCommon('clear')}
          </Button>
        ) : null}
      </form>
    </div>
  );
}

function UsersStatsCards({ users, pagination, t }: UsersStatsCardsProps) {
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

function UsersResultsInfo({ users, pagination, searchTerm, t }: UsersResultsInfoProps) {
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
  onOpenStatusModal,
}: UserRowProps) {
  const isDisabled = user.disable === ACCOUNT_DISABLE_DISABLED;

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
        <div className="flex flex-col gap-1">
          <Badge variant={user.accountStatusVariant}>{t(user.accountStatusLabel)}</Badge>
          {isDisabled && user.disabledAt && user.disabledAtLabel ? (
            <span className="text-xs text-neutral-500">
              {t('disabledAt')}: <time dateTime={user.disabledAt}>{user.disabledAtLabel}</time>
            </span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <div className="flex items-center gap-x-2">
          {getSubscriptionBadge(user, t)}
          {user.subscription?.startDate && user.subscription.startDateLabel ? (
            <span className="text-sm text-neutral-500">
              <time dateTime={user.subscription.startDate}>{user.subscription.startDateLabel}</time>
            </span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-500">
        <time dateTime={user.createdAt}>{user.createdAtLabel}</time>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
        <div className="flex justify-end gap-x-2">
          {user.email !== sessionEmail ? (
            <>
              {!isDisabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenSubscriptionModal(user)}
                  disabled={actionLoading === user.id}
                  className="min-h-[40px] border-green-300 px-3 text-green-600 hover:bg-green-50"
                >
                  {t('addSubscription')}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenRoleModal(user)}
                disabled={actionLoading === user.id}
                className="min-h-[40px] px-3"
              >
                {user.role === 'admin' ? t('makeUser') : t('makeAdmin')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenStatusModal(user)}
                disabled={actionLoading === user.id}
                className={
                  isDisabled
                    ? 'min-h-[40px] border-green-300 px-3 text-green-700 hover:bg-green-50'
                    : 'min-h-[40px] border-red-300 px-3 text-red-600 hover:bg-red-50'
                }
              >
                {isDisabled ? t('restore') : t('disable')}
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
  onOpenStatusModal,
}: UsersTableProps) {
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
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500"
                >
                  {t('user')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500"
                >
                  {t('role')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500"
                >
                  {t('accountStatus')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500"
                >
                  {t('subscription')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500"
                >
                  {t('created')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500"
                >
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  {...(sessionEmail !== undefined ? { sessionEmail } : {})}
                  actionLoading={actionLoading}
                  t={t}
                  onOpenSubscriptionModal={onOpenSubscriptionModal}
                  onOpenRoleModal={onOpenRoleModal}
                  onOpenStatusModal={onOpenStatusModal}
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
}: RoleModalProps) {
  if (!selectedUser) return null;

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('changeUserRole')}
      message={t('changeRoleConfirm', { email: selectedUser.email, role: newRole })}
      cancelText={t('cancel')}
      confirmText={t('changeRole')}
      onCancel={onClose}
      onConfirm={onConfirm}
      isLoading={actionLoading === selectedUser?.id}
    />
  );
}

function StatusUserModal({
  isOpen,
  selectedUser,
  actionLoading,
  onClose,
  onConfirm,
  t,
}: StatusUserModalProps) {
  if (!selectedUser) return null;

  const isDisabled = selectedUser.disable === ACCOUNT_DISABLE_DISABLED;

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={isDisabled ? t('restoreUser') : t('disableUser')}
      message={
        isDisabled
          ? t('restoreUserConfirm', { email: selectedUser.email })
          : t('disableUserConfirm', { email: selectedUser.email })
      }
      cancelText={t('cancel')}
      confirmText={isDisabled ? t('restoreUserButton') : t('disableUserButton')}
      confirmVariant={isDisabled ? 'default' : 'destructive'}
      onCancel={onClose}
      onConfirm={onConfirm}
      isLoading={actionLoading === selectedUser?.id}
    />
  );
}

function SubscriptionPlanButton({ plan, selectedPlanId, onSelect }: SubscriptionPlanButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={`min-h-[72px] w-full justify-start rounded-lg border p-4 transition-colors ${
        selectedPlanId === plan.id
          ? 'border-green-500 bg-green-50'
          : 'border-neutral-200 hover:border-neutral-300'
      }`}
      onClick={() => onSelect(plan)}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-neutral-900">{plan.name}</h3>
          <p className="text-sm text-neutral-600">{plan.priceLabel}</p>
          <p className="text-sm text-neutral-500">{plan.durationLabel}</p>
        </div>
        {selectedPlanId === plan.id ? (
          <div className="text-brand-trust">
            <HiOutlineCheck className="size-5" />
          </div>
        ) : null}
      </div>
    </Button>
  );
}

function SelectedPlanDetails({ plan, t }: SelectedPlanDetailsProps) {
  return (
    <div className="rounded-lg bg-neutral-50 p-4">
      <h4 className="mb-2 font-medium text-neutral-900">{t('selectedPlanDetails')}</h4>
      <div className="text-sm text-neutral-600">
        <p>
          <strong>{t('plan')}</strong> {plan.name}
        </p>
        <p>
          <strong>{t('price')}</strong> {plan.priceLabel}
        </p>
        <p>
          <strong>{t('duration')}</strong> {plan.durationLabel}
        </p>
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
}: SubscriptionModalProps) {
  if (!selectedUser) return null;

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('addSubscriptionTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">{t('selectPlan', { email: selectedUser.email })}</p>

        <div className="space-y-3">
          {plans.map((plan) => (
            <SubscriptionPlanButton
              key={plan.id}
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
          isLoading={actionLoading === selectedUser?.id}
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

  const params = new URLSearchParams({
    page: state.page.toString(),
    limit: limit.toString(),
    status: state.statusFilter,
  });

  if (state.searchTerm) {
    params.set('search', state.searchTerm);
  }

  const swrKey = `/api/admin/users?${params}`;

  const {
    data: usersData,
    error: usersError,
    isLoading: usersLoading,
    mutate: mutateUsers,
  } = useSWR<AdminUserListViewModel>(swrKey, fetchAdminUserListViewModel, {
    keepPreviousData: true,
  });

  const { data: plansData } = useSWR('/api/admin/plans', () => fetchAdminBillingPlanViewModels());

  const users = usersData?.users ?? [];
  const plans = plansData ?? [];
  const pagination: AdminUsersPaginationViewModel = usersData
    ? usersData.pagination
    : { page: state.page, limit, total: 0, totalPages: 0 };

  // Full-page skeleton only on cold start (no data yet). Filter/page/search refetches keep controls mounted.
  const isColdStart = usersLoading && !usersData;

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'applySearch' });
  };

  /**
   * Runs a server mutation, then revalidates the list.
   * Returns the mutation response so callers can build copy from server state.
   * Revalidation failures never look like mutation failures (no unsafe retry prompt).
   */
  const runUserAction = async <T,>(
    userId: string,
    request: AdminUserActionRequest<T>,
    successMessageFor: (response: T) => string,
    refreshWarningMessage: string,
  ): Promise<T | null> => {
    dispatch({ type: 'patch', value: { actionLoading: userId, localError: '', success: '' } });

    let response: T;
    try {
      response = await request();
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          actionLoading: null,
          localError: extractUnknownErrorMessage(error, 'Request failed'),
        },
      });
      return null;
    }

    const successMessage = successMessageFor(response);

    try {
      await mutateUsers();
      dispatch({
        type: 'patch',
        value: {
          actionLoading: null,
          success: successMessage,
          localError: '',
        },
      });
      dispatch({ type: 'closeModal' });
    } catch {
      // Mutation already committed — surface a refresh warning, not a failed mutation.
      dispatch({
        type: 'patch',
        value: {
          actionLoading: null,
          success: successMessage,
          localError: refreshWarningMessage,
        },
      });
      dispatch({ type: 'closeModal' });
    }

    return response;
  };

  const handleChangeRole = async () => {
    if (!state.selectedUser) return;
    const selectedUser = state.selectedUser;

    await runUserAction(
      selectedUser.id,
      () =>
        updateAdminUserRole({
          userId: selectedUser.id,
          role: state.newRole,
        }),
      () => `User role updated to ${state.newRole}`,
      t('userActionRefreshWarning'),
    );
  };

  const handleToggleUserStatus = async () => {
    if (!state.selectedUser) return;
    const selectedUser = state.selectedUser;
    const targetDisable =
      selectedUser.disable === ACCOUNT_DISABLE_DISABLED
        ? ACCOUNT_DISABLE_ACTIVE
        : ACCOUNT_DISABLE_DISABLED;

    await runUserAction(
      selectedUser.id,
      () =>
        updateAdminUserStatus({
          userId: selectedUser.id,
          disable: targetDisable,
        }),
      (status) => {
        if (targetDisable === ACCOUNT_DISABLE_DISABLED) {
          return status.changed ? t('userDisabledSuccess') : t('userAlreadyDisabled');
        }
        return status.changed ? t('userRestoredSuccess') : t('userAlreadyActive');
      },
      t('userStatusRefreshWarning'),
    );
  };

  const handleAddSubscription = async () => {
    if (!state.selectedUser || !state.selectedPlanId) return;
    const selectedUser = state.selectedUser;

    await runUserAction(
      selectedUser.id,
      () =>
        grantAdminUserSubscription({
          userId: selectedUser.id,
          planId: state.selectedPlanId,
        }),
      () => `Subscription added successfully for ${selectedUser.email}`,
      t('userActionRefreshWarning'),
    );
  };

  if (isColdStart) {
    return (
      <AdminPageShell>
        <div className="mx-auto max-w-6xl">
          <AdminUsersPageSkeleton />
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader title={t('userManagement')} description={t('manageUserAccounts')} />

        <UsersSearchBar
          searchTerm={state.searchInput}
          statusFilter={state.statusFilter}
          onSearchTermChange={(value) => dispatch({ type: 'setSearchInput', value })}
          onStatusFilterChange={(value) => dispatch({ type: 'setStatusFilter', value })}
          onSubmit={handleSearch}
          onClear={() => dispatch({ type: 'resetSearch' })}
          t={t}
          tCommon={tCommon}
        />

        {usersError || state.localError ? (
          <ErrorState message={usersError?.message ?? state.localError} className="mb-6" />
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
          {...(session?.user?.email !== undefined ? { sessionEmail: session.user.email } : {})}
          actionLoading={state.actionLoading}
          searchTerm={state.searchTerm}
          t={t}
          onOpenSubscriptionModal={(user) => dispatch({ type: 'openSubscriptionModal', user })}
          onOpenRoleModal={(user) => dispatch({ type: 'openRoleModal', user })}
          onOpenStatusModal={(user) => dispatch({ type: 'openStatusModal', user })}
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

      <StatusUserModal
        isOpen={state.activeModal === 'status'}
        selectedUser={state.selectedUser}
        actionLoading={state.actionLoading}
        onClose={() => dispatch({ type: 'closeModal' })}
        onConfirm={() => void handleToggleUserStatus()}
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
            planId: plan.id,
          })
        }
        t={t}
      />
    </AdminPageShell>
  );
}
