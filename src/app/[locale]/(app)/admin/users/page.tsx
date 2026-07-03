'use client';

import { useReducer } from 'react';
import type { FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminUsersPageSkeleton } from '@/components/admin/AdminLoadingSkeletons';
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
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { ModalActions } from '@/components/ui/ModalActions';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineCheck, HiOutlineSearch } from 'react-icons/hi';
import {
  deleteAdminUser,
  fetchAdminUserListViewModel,
  grantAdminUserSubscription,
  updateAdminUserRole,
} from '@/features/admin/users/api/admin-users-api';
import type {
  AdminUserListViewModel,
  AdminUserRoleViewModel,
  AdminUsersPaginationViewModel,
  AdminUserViewModel,
} from '@/features/admin/users/types/admin-users-view-model';
import { fetchAdminBillingPlanViewModels } from '@/features/admin/plans/api/admin-plans-api';
import type { AdminBillingPlanViewModel } from '@/features/admin/plans/types/admin-plans-view-model';
import { extractUnknownErrorMessage } from '@/lib/api/error';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
type AdminUsersModal = 'delete' | 'role' | 'subscription' | null;
type AdminUserActionRequest = () => Promise<unknown>;

interface AdminUsersTranslationProps {
  t: TranslateFn;
}

interface UsersSearchBarProps extends AdminUsersTranslationProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
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
  onOpenDeleteModal: (user: AdminUserViewModel) => void;
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
  newRole: AdminUserRoleViewModel;
  actionLoading: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

interface DeleteUserModalProps extends AdminUsersTranslationProps {
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
  page: number;
  activeModal: AdminUsersModal;
  selectedUser: AdminUserViewModel | null;
  newRole: AdminUserRoleViewModel;
  selectedPlanId: string;
}

type AdminUsersAction =
  | { type: 'patch'; value: Partial<AdminUsersState> }
  | { type: 'setPage'; value: number }
  | { type: 'setSearchInput'; value: string }
  | { type: 'applySearch' }
  | { type: 'resetSearch' }
  | { type: 'openRoleModal'; user: AdminUserViewModel }
  | { type: 'openDeleteModal'; user: AdminUserViewModel }
  | { type: 'openSubscriptionModal'; user: AdminUserViewModel }
  | { type: 'closeModal' }
  | { type: 'setSelectedPlan'; planId: string };

const initialState: AdminUsersState = {
  actionLoading: null,
  localError: '',
  success: '',
  searchInput: '',
  searchTerm: '',
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
    default:
      return state;
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
  onSearchTermChange,
  onSubmit,
  onClear,
  t,
  tCommon,
}: UsersSearchBarProps) {
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
  onOpenDeleteModal,
}: UserRowProps) {
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenSubscriptionModal(user)}
                disabled={actionLoading === user.id}
                className="min-h-[40px] border-green-300 px-3 text-green-600 hover:bg-green-50"
              >
                {t('addSubscription')}
              </Button>
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
                onClick={() => onOpenDeleteModal(user)}
                disabled={actionLoading === user.id}
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
                  key={user.id}
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

function DeleteUserModal({
  isOpen,
  selectedUser,
  actionLoading,
  onClose,
  onConfirm,
  t,
}: DeleteUserModalProps) {
  if (!selectedUser) return null;

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('deleteUser')}
      message={t('deleteUserConfirm', { email: selectedUser.email })}
      cancelText={t('cancel')}
      confirmText={t('deleteUserButton')}
      confirmVariant="destructive"
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
  } = useSWR<AdminUserListViewModel>(swrKey, fetchAdminUserListViewModel);

  const { data: plansData } = useSWR('/api/admin/plans', fetchAdminBillingPlanViewModels);

  const users = usersData?.users ?? [];
  const plans = plansData ?? [];
  const pagination: AdminUsersPaginationViewModel = usersData
    ? usersData.pagination
    : { page: state.page, limit, total: 0, totalPages: 0 };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'applySearch' });
  };

  const runUserAction = async (
    userId: string,
    request: AdminUserActionRequest,
    successMessage: string,
  ) => {
    dispatch({ type: 'patch', value: { actionLoading: userId, localError: '', success: '' } });

    try {
      await request();
      void mutateUsers();
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
          localError: extractUnknownErrorMessage(error, 'Request failed'),
        },
      });
    }
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
      `User role updated to ${state.newRole}`,
    );
  };

  const handleDeleteUser = async () => {
    if (!state.selectedUser) return;
    const selectedUser = state.selectedUser;

    await runUserAction(
      selectedUser.id,
      () => deleteAdminUser(selectedUser.id),
      'User deleted successfully',
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
      `Subscription added successfully for ${selectedUser.email}`,
    );
  };

  if (usersLoading) {
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
          onSearchTermChange={(value) => dispatch({ type: 'setSearchInput', value })}
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
            planId: plan.id,
          })
        }
        t={t}
      />
    </AdminPageShell>
  );
}
