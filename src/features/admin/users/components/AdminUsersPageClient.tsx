'use client';

import { useReducer } from 'react';
import type { FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminUsersPageSkeleton } from '@/features/admin/components/AdminLoadingSkeletons';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { AdminSearchInput } from '@/features/admin/components/AdminSearchInput';
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
import { Input, Textarea } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HiOutlineCheck } from 'react-icons/hi';
import {
  fetchAdminUserListViewModel,
  grantAdminUserCredits,
  grantAdminUserSubscription,
  updateAdminUserRole,
  updateAdminUserStatus,
  updateAdminUserTestAccount,
} from '@/features/admin/users/api/admin-users-api';
import {
  TestAccountBadge,
  TestAccountModal,
} from '@/features/admin/users/components/AdminUserTestAccountControls';
import { AdminUserActionsMenu } from '@/features/admin/users/components/AdminUserActionsMenu';
import type { AdminUserActionCallbacks } from '@/features/admin/users/components/AdminUserActionsMenu';
import type {
  AdminUserListViewModel,
  AdminUserStatusFilter,
  AdminUsersPaginationViewModel,
  AdminUserViewModel,
} from '@/features/admin/users/types/admin-users-view-model';
import { fetchAdminBillingPlanViewModels } from '@/features/admin/plans/api/admin-plans-api';
import type { AdminBillingPlanViewModel } from '@/features/admin/plans/types/admin-plans-view-model';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
import type { UserRole } from '@/types/next-auth';
import {
  ACCOUNT_DISABLE_ACTIVE,
  ACCOUNT_DISABLE_DISABLED,
} from '@/shared/constants/account-disable';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
type AdminUsersModal = 'status' | 'role' | 'subscription' | 'credit' | 'testAccount' | null;
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

interface UserRowProps extends AdminUsersTranslationProps, AdminUserActionCallbacks {
  user: AdminUserViewModel;
  sessionEmail?: string | null;
  actionLoading: string | null;
}

interface UsersTableProps extends AdminUsersTranslationProps, AdminUserActionCallbacks {
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

interface CreditModalProps extends AdminUsersTranslationProps {
  isOpen: boolean;
  selectedUser: AdminUserViewModel | null;
  amount: string;
  note: string;
  actionLoading: string | null;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
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
  creditAmount: string;
  creditNote: string;
  creditIdempotencyKey: string;
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
  | { type: 'openTestAccountModal'; user: AdminUserViewModel }
  | { type: 'openSubscriptionModal'; user: AdminUserViewModel }
  | { type: 'openCreditModal'; user: AdminUserViewModel; idempotencyKey: string }
  | { type: 'closeModal' }
  | { type: 'setSelectedPlan'; planId: string }
  | { type: 'setCreditAmount'; value: string }
  | { type: 'setCreditNote'; value: string };

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
  creditAmount: '1',
  creditNote: '',
  creditIdempotencyKey: '',
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
    case 'openTestAccountModal':
      return {
        ...state,
        selectedUser: action.user,
        activeModal: 'testAccount',
      };
    case 'openSubscriptionModal':
      return {
        ...state,
        selectedUser: action.user,
        activeModal: 'subscription',
        selectedPlanId: '',
      };
    case 'openCreditModal':
      return {
        ...state,
        selectedUser: action.user,
        activeModal: 'credit',
        creditAmount: '1',
        creditNote: '',
        creditIdempotencyKey: action.idempotencyKey,
      };
    case 'closeModal':
      return {
        ...state,
        activeModal: null,
        selectedUser: null,
        actionLoading: null,
        creditAmount: '1',
        creditNote: '',
        creditIdempotencyKey: '',
      };
    case 'setSelectedPlan':
      return {
        ...state,
        selectedPlanId: action.planId,
      };
    case 'setCreditAmount':
      return { ...state, creditAmount: action.value };
    case 'setCreditNote':
      return { ...state, creditNote: action.value };
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

interface UserIdentityProps extends AdminUsersTranslationProps {
  user: AdminUserViewModel;
  isSelf: boolean;
  emailId: string;
}

/** Email (truncated, full value in `title`), then subscription and created on one line. */
function UserIdentity({ user, isSelf, emailId, t }: UserIdentityProps) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span
          id={emailId}
          title={user.email}
          className="min-w-0 truncate text-sm font-medium text-neutral-900"
        >
          {user.email}
        </span>
        {isSelf ? (
          <span className="inline-flex min-h-[28px] shrink-0 items-center rounded-full bg-neutral-100 px-3 text-[13px] font-medium text-neutral-600">
            {t('you')}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
        <span>{t('subscription')}:</span>
        {getSubscriptionBadge(user, t)}
        {user.subscription?.startDate && user.subscription.startDateLabel ? (
          <time dateTime={user.subscription.startDate}>{user.subscription.startDateLabel}</time>
        ) : null}
        <span aria-hidden="true">·</span>
        <span>
          {t('created')}: <time dateTime={user.createdAt}>{user.createdAtLabel}</time>
        </span>
      </div>
      <TestAccountBadge user={user} t={t} />
    </div>
  );
}

function UserStatus({ user, t }: { user: AdminUserViewModel; t: TranslateFn }) {
  const isDisabled = user.disable === ACCOUNT_DISABLE_DISABLED;
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={user.accountStatusVariant}>{t(user.accountStatusLabel)}</Badge>
      {isDisabled && user.disabledAt && user.disabledAtLabel ? (
        <span className="text-xs text-neutral-500">
          {t('disabledAt')}: <time dateTime={user.disabledAt}>{user.disabledAtLabel}</time>
        </span>
      ) : null}
    </div>
  );
}

function userActionsMenuProps(
  { user, sessionEmail, actionLoading, t, ...callbacks }: UserRowProps,
  describedBy: string,
) {
  return {
    ...callbacks,
    user,
    t,
    describedBy,
    isSelf: user.email === sessionEmail,
    busy: actionLoading === user.id,
  };
}

function UserRow(props: UserRowProps) {
  const { user, sessionEmail, t } = props;
  const emailId = `admin-user-${user.id}-email`;

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-4 align-top">
        <UserIdentity user={user} isSelf={user.email === sessionEmail} emailId={emailId} t={t} />
      </td>
      <td className="px-4 py-4 align-top">
        {getRoleBadge(user.role, user.role === 'admin' ? t('administrator') : t('user'))}
      </td>
      <td className="px-4 py-4 align-top">
        <UserStatus user={user} t={t} />
      </td>
      <td className="px-4 py-4 text-right align-top">
        <div className="flex justify-end">
          <AdminUserActionsMenu {...userActionsMenuProps(props, emailId)} />
        </div>
      </td>
    </tr>
  );
}

/** Below `md` each user is a card with the same actions (RIN-1021). */
function UserCard(props: UserRowProps) {
  const { user, sessionEmail, t } = props;
  const emailId = `admin-user-${user.id}-email-card`;

  return (
    <li className="flex flex-col gap-3 py-4">
      <UserIdentity user={user} isSelf={user.email === sessionEmail} emailId={emailId} t={t} />
      <div className="flex flex-wrap items-start gap-2">
        {getRoleBadge(user.role, user.role === 'admin' ? t('administrator') : t('user'))}
        <UserStatus user={user} t={t} />
      </div>
      <AdminUserActionsMenu {...userActionsMenuProps(props, emailId)} />
    </li>
  );
}

const HEADER_CELL_CLASS = 'px-4 py-3 text-xs font-medium uppercase tracking-wider text-neutral-500';

function UsersTable({
  users,
  sessionEmail,
  actionLoading,
  searchTerm,
  t,
  ...callbacks
}: UsersTableProps) {
  const rowProps = (user: AdminUserViewModel): UserRowProps => ({
    ...callbacks,
    user,
    ...(sessionEmail !== undefined ? { sessionEmail } : {}),
    actionLoading,
    t,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('allUsers')}</CardTitle>
        <CardDescription>{t('manageUserRoles')}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Fixed layout: a long email truncates instead of widening the table. */}
        <table className="hidden w-full table-fixed divide-y divide-neutral-200 md:table">
          <thead className="bg-neutral-50">
            <tr>
              <th scope="col" className={`${HEADER_CELL_CLASS} text-left`}>
                {t('user')}
              </th>
              <th scope="col" className={`${HEADER_CELL_CLASS} w-36 text-left`}>
                {t('role')}
              </th>
              <th scope="col" className={`${HEADER_CELL_CLASS} w-40 text-left`}>
                {t('accountStatus')}
              </th>
              <th scope="col" className={`${HEADER_CELL_CLASS} w-36 text-right`}>
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {users.map((user) => (
              <UserRow key={user.id} {...rowProps(user)} />
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-neutral-200 md:hidden">
          {users.map((user) => (
            <UserCard key={user.id} {...rowProps(user)} />
          ))}
        </ul>

        {users.length === 0 ? (
          <EmptyState
            title={searchTerm ? t('noUsersMatching', { term: searchTerm }) : t('noUsersFound')}
            className="py-8"
          />
        ) : null}
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
          : 'border-line hover:border-accent'
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

function CreditModal({
  isOpen,
  selectedUser,
  amount,
  note,
  actionLoading,
  onAmountChange,
  onNoteChange,
  onClose,
  onConfirm,
  t,
}: CreditModalProps) {
  if (!selectedUser) return null;

  const parsedAmount = Number(amount);
  const amountIsValid = Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= 1000;
  const noteIsValid = note.trim().length >= 3 && note.trim().length <= 500;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('addCreditTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          {t('addCreditDescription', { email: selectedUser.email })}
        </p>
        <Input
          type="number"
          min={1}
          max={1000}
          step={1}
          inputMode="numeric"
          label={t('creditAmount')}
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          error={amount && !amountIsValid ? t('creditAmountError') : undefined}
        />
        <Textarea
          label={t('creditReason')}
          placeholder={t('creditReasonPlaceholder')}
          maxLength={500}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          error={note && !noteIsValid ? t('creditReasonError') : undefined}
        />
        <p className="text-xs text-neutral-500">{t('creditLedgerNotice')}</p>
        <ModalActions
          cancelText={t('cancel')}
          confirmText={t('addCreditButton')}
          onCancel={onClose}
          onConfirm={onConfirm}
          isLoading={actionLoading === selectedUser.id}
          isDisabled={!amountIsValid || !noteIsValid}
        />
      </div>
    </Modal>
  );
}

export function AdminUsersPageClient() {
  const t = useTranslations('admin');
  const describeError = useAdminApiErrorMessage();
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
  // A Retry after a failed first load keeps ErrorState up with a pending button instead (RIN-1166).
  const isColdStart = usersLoading && !usersData && !usersError;

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
          localError: describeError(error),
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

  const handleToggleTestAccount = async () => {
    if (!state.selectedUser) return;
    const selectedUser = state.selectedUser;
    const isTestAccount = !selectedUser.isTestAccount;

    await runUserAction(
      selectedUser.id,
      () => updateAdminUserTestAccount({ userId: selectedUser.id, isTestAccount }),
      (result) => {
        if (!result.changed) return t('testAccountUnchanged');
        return isTestAccount ? t('testAccountMarkedSuccess') : t('testAccountUnmarkedSuccess');
      },
      t('userActionRefreshWarning'),
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

  const handleAddCredit = async () => {
    if (!state.selectedUser || !state.creditIdempotencyKey) return;
    const selectedUser = state.selectedUser;
    const amount = Number(state.creditAmount);
    const note = state.creditNote.trim();
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000 || note.length < 3) return;

    await runUserAction(
      selectedUser.id,
      () =>
        grantAdminUserCredits({
          userId: selectedUser.id,
          amount,
          note,
          idempotencyKey: state.creditIdempotencyKey,
        }),
      (result) =>
        t('creditAddedSuccess', {
          amount: result.amount,
          email: selectedUser.email,
          balance: result.balance,
        }),
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

        {usersError && !usersData ? (
          // A failed load replaces the stats and the table: zeros would read as data (RIN-1022).
          <ErrorState error={usersError} onRetry={() => mutateUsers()} className="mb-6" />
        ) : (
          <>
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

            {usersError ? (
              // A failed refetch keeps the loaded rows; this says they may be stale (RIN-1166).
              <ErrorState error={usersError} onRetry={() => mutateUsers()} className="mb-6" />
            ) : null}

            {state.localError ? <ErrorState message={state.localError} className="mb-6" /> : null}

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
              onOpenCreditModal={(user) =>
                dispatch({ type: 'openCreditModal', user, idempotencyKey: crypto.randomUUID() })
              }
              onOpenSubscriptionModal={(user) => dispatch({ type: 'openSubscriptionModal', user })}
              onOpenRoleModal={(user) => dispatch({ type: 'openRoleModal', user })}
              onOpenStatusModal={(user) => dispatch({ type: 'openStatusModal', user })}
              onOpenTestAccountModal={(user) => dispatch({ type: 'openTestAccountModal', user })}
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
          </>
        )}
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

      <TestAccountModal
        isOpen={state.activeModal === 'testAccount'}
        selectedUser={state.selectedUser}
        actionLoading={state.actionLoading}
        onClose={() => dispatch({ type: 'closeModal' })}
        onConfirm={() => void handleToggleTestAccount()}
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

      <CreditModal
        isOpen={state.activeModal === 'credit'}
        selectedUser={state.selectedUser}
        amount={state.creditAmount}
        note={state.creditNote}
        actionLoading={state.actionLoading}
        onAmountChange={(value) => dispatch({ type: 'setCreditAmount', value })}
        onNoteChange={(value) => dispatch({ type: 'setCreditNote', value })}
        onClose={() => dispatch({ type: 'closeModal' })}
        onConfirm={() => void handleAddCredit()}
        t={t}
      />
    </AdminPageShell>
  );
}
