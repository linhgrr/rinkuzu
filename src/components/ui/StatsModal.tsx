'use client';

import { useEffect, useReducer, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserProfileLink } from '@/components/user/UserProfileLink';
import { fetchStatsModalViewModel } from '@/features/admin/stats/api/admin-stats-api';
import type {
  StatsModalActivityItemViewModel,
  StatsModalCreatorItemViewModel,
  StatsModalItemViewModel,
  StatsModalPaginationViewModel,
} from '@/features/admin/stats/types/stats-modal-view-model';
import Pagination from './Pagination';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'creators' | 'activity';
  apiEndpoint: string;
  children?: React.ReactNode;
}

interface SortOption {
  value: string;
  label: string;
}

interface StatsModalState {
  data: StatsModalItemViewModel[];
  loading: boolean;
  error: string;
  pagination: StatsModalPaginationViewModel;
  searchTerm: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

type StatsModalAction =
  | { type: 'loadStart'; clearError: boolean }
  | {
      type: 'loadSuccess';
      data: StatsModalItemViewModel[];
      pagination: StatsModalPaginationViewModel;
      append: boolean;
    }
  | { type: 'loadError'; error: string }
  | { type: 'setSearchTerm'; value: string }
  | { type: 'setSort'; sortBy: string; sortOrder: 'asc' | 'desc' };

const initialPagination: StatsModalPaginationViewModel = {
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  itemsPerPage: 20,
  hasNextPage: false,
  hasPrevPage: false,
};

const initialStatsModalState: StatsModalState = {
  data: [],
  loading: false,
  error: '',
  pagination: initialPagination,
  searchTerm: '',
  sortBy: '',
  sortOrder: 'desc',
};

function statsModalReducer(state: StatsModalState, action: StatsModalAction): StatsModalState {
  switch (action.type) {
    case 'loadStart':
      return {
        ...state,
        loading: true,
        error: action.clearError ? '' : state.error,
      };
    case 'loadSuccess':
      return {
        ...state,
        loading: false,
        error: '',
        data: action.append ? [...state.data, ...action.data] : action.data,
        pagination: action.pagination,
      };
    case 'loadError':
      return {
        ...state,
        loading: false,
        error: action.error,
      };
    case 'setSearchTerm':
      return {
        ...state,
        searchTerm: action.value,
      };
    case 'setSort':
      return {
        ...state,
        sortBy: action.sortBy,
        sortOrder: action.sortOrder,
      };
    default:
      return state;
  }
}

function isCreatorStat(item: StatsModalItemViewModel): item is StatsModalCreatorItemViewModel {
  return 'quizCount' in item && 'totalQuestions' in item && 'joinedAt' in item;
}

function isActivityItem(item: StatsModalItemViewModel): item is StatsModalActivityItemViewModel {
  return 'type' in item && 'data' in item && 'date' in item;
}

function getSortOptions(type: StatsModalProps['type'], t: (key: string) => string): SortOption[] {
  switch (type) {
    case 'creators':
      return [
        { value: 'quizCount', label: t('quizCount') },
        { value: 'totalQuestions', label: t('totalQuestions') },
        { value: 'joinedAt', label: t('joinedAt') },
      ];
    default:
      return [];
  }
}

function CreatorItem({
  creator,
  index,
  currentPage,
  limit,
  t,
}: {
  creator: StatsModalCreatorItemViewModel;
  index: number;
  currentPage: number;
  limit: number;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
      <div className="flex items-center gap-x-4">
        <span className="text-sm font-medium text-neutral-500">
          #{index + 1 + (currentPage - 1) * limit}
        </span>
        <div className="size-8 bg-gradient-to-br from-green-400 to-brand-trust rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">{creator.email[0].toUpperCase()}</span>
        </div>
        <div>
          <h4 className="font-medium text-neutral-900">{creator.email}</h4>
          <div className="flex items-center gap-x-2 text-xs text-neutral-500">
            <span>
              {t('joined')}: {creator.joinedAtLabel}
            </span>
            {creator.role === 'admin' && (
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">Admin</span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">{creator.quizCount} quiz</div>
        <div className="text-xs text-neutral-500">
          {creator.totalQuestions} {t('questionsCount')}
        </div>
      </div>
    </div>
  );
}

function ActivityItem({
  activity,
  t,
}: {
  activity: StatsModalActivityItemViewModel;
  t: (key: string) => string;
}) {
  const { type: activityType } = activity;
  const activityKey = activity.id;

  return (
    <div
      key={activityKey}
      className="flex items-center gap-x-4 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
    >
      <div
        className={`size-10 rounded-full flex items-center justify-center ${
          activityType === 'quiz' ? 'bg-green-100 text-green-600' : 'bg-green-100 text-brand-trust'
        }`}
      >
        {activityType === 'user' && (
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        )}
        {activityType === 'quiz' && (
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}
        {activityType === 'attempt' && (
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        )}
      </div>

      <div className="flex-1">
        {activityType === 'user' && (
          <div>
            <h4 className="font-medium text-neutral-900">
              {t('newUser')}: {activity.data.email}
            </h4>
            <p className="text-sm text-neutral-600">{t('registered')}</p>
          </div>
        )}
        {activityType === 'quiz' && (
          <div>
            <h4 className="font-medium text-neutral-900">{activity.data.title}</h4>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
              <span className="shrink-0">{t('by')}</span>
              <UserProfileLink
                user={activity.data.author}
                avatarSize={20}
                className="max-w-[220px] text-sm text-neutral-600"
                nameClassName="text-sm"
              />
              <span>•</span>
              <span>
                {activity.data.questionCount} {t('questionsCount')}
              </span>
            </div>
          </div>
        )}
        {activityType === 'attempt' && (
          <div>
            <h4 className="font-medium text-neutral-900">{activity.data.quiz.title}</h4>
            <p className="text-sm text-neutral-600">
              {activity.data.actor.email} • Score: {activity.data.score}% •{' '}
              {activity.data.answeredQuestions} {t('answeredQuestions')}
            </p>
          </div>
        )}
        <p className="text-xs text-neutral-400">{activity.dateLabel}</p>
      </div>

      {activityType === 'attempt' && (
        <div className="text-right">
          <div
            className={`text-sm font-medium ${
              activity.data.score >= 80
                ? 'text-green-600'
                : activity.data.score >= 60
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {activity.data.score}%
          </div>
        </div>
      )}
    </div>
  );
}

function StatsModalContent({
  data,
  error,
  loading,
  onRetry,
  currentPage,
  limit,
  t,
  type,
}: {
  data: StatsModalItemViewModel[];
  error: string;
  loading: boolean;
  onRetry: () => void;
  currentPage: number;
  limit: number;
  t: (key: string) => string;
  type: StatsModalProps['type'];
}) {
  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <Button onClick={onRetry} className="mt-2" size="sm">
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500">{t('noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        switch (type) {
          case 'creators':
            if (!isCreatorStat(item)) return null;
            return (
              <CreatorItem
                key={item.id}
                creator={item}
                index={index}
                currentPage={currentPage}
                limit={limit}
                t={t}
              />
            );
          case 'activity':
            if (!isActivityItem(item)) return null;
            return <ActivityItem key={item.id} activity={item} t={t} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function SortControls({
  options,
  onSortChange,
  sortBy,
  sortOrder,
  t,
}: {
  options: SortOption[];
  onSortChange: (field: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  t: (key: string) => string;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-x-4">
      <span className="text-sm text-neutral-600">{t('sortBy')}</span>
      <div className="flex gap-x-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSortChange(option.value)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              sortBy === option.value
                ? 'bg-green-100 text-brand-trust'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {option.label}
            {sortBy === option.value && (
              <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface StatsModalBodyProps {
  children?: React.ReactNode;
  loadData: (
    page?: number,
    search?: string,
    append?: boolean,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) => Promise<void>;
  state: StatsModalState;
  title: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  type: StatsModalProps['type'];
  onSortChange: (field: string) => void;
  sortOptions: SortOption[];
  onSearchTermChange: (value: string) => void;
}

function StatsModalBody({
  children,
  loadData,
  onSearchTermChange,
  onSortChange,
  sortOptions,
  state,
  t,
  title,
  type,
}: StatsModalBodyProps) {
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadData(1, state.searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    void loadData(newPage);
  };

  const handleLoadMore = () => {
    if (state.pagination.hasNextPage) {
      void loadData(state.pagination.currentPage + 1, state.searchTerm, true);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900 mb-2">{title}</h2>
        <p className="text-neutral-600">
          {t('showing', { count: state.data.length, total: state.pagination.totalItems })}
        </p>
      </div>

      <div className="mb-6 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-x-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={state.searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={state.loading}>
            {t('search')}
          </Button>
        </form>

        <SortControls
          options={sortOptions}
          onSortChange={onSortChange}
          sortBy={state.sortBy}
          sortOrder={state.sortOrder}
          t={t}
        />
      </div>

      {children}

      <div className="max-h-96 overflow-y-auto">
        <StatsModalContent
          data={state.data}
          error={state.error}
          loading={state.loading}
          onRetry={() => {
            void loadData(1);
          }}
          currentPage={state.pagination.currentPage}
          limit={state.pagination.itemsPerPage}
          t={t}
          type={type}
        />
      </div>

      {state.loading && state.data.length > 0 && (
        <div className="text-center py-4">
          <div className="inline-flex items-center text-sm text-neutral-600">
            <div className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mr-2" />
            {t('loadingMore')}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between items-center">
        <div className="flex gap-x-2">
          {type === 'activity' && state.pagination.hasNextPage && (
            <Button onClick={handleLoadMore} variant="outline" disabled={state.loading} size="sm">
              {t('loadMore')}
            </Button>
          )}
        </div>

        {type !== 'activity' && state.pagination.totalPages > 1 && (
          <Pagination
            currentPage={state.pagination.currentPage}
            totalPages={state.pagination.totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}

export default function StatsModal({
  isOpen,
  onClose,
  title,
  type,
  apiEndpoint,
  children,
}: StatsModalProps) {
  const t = useTranslations('statsModal');
  const [state, dispatch] = useReducer(statsModalReducer, initialStatsModalState);
  const sortOptions = getSortOptions(type, t);
  const requestSignature = `${type}:${apiEndpoint}`;
  const activeRequestRef = useRef(0);
  const loadedSignatureRef = useRef<string | null>(null);
  const latestLoadDataRef = useRef<
    (
      page?: number,
      search?: string,
      append?: boolean,
      sortBy?: string,
      sortOrder?: 'asc' | 'desc',
    ) => Promise<void>
  >(async () => {});

  const loadData = async (
    page = 1,
    search?: string,
    append = false,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    const resolvedSearch = search ?? state.searchTerm;
    const resolvedSortBy = sortBy ?? state.sortBy;
    const resolvedSortOrder = sortOrder ?? state.sortOrder;
    dispatch({ type: 'loadStart', clearError: !append });

    try {
      const result = await fetchStatsModalViewModel({
        type,
        apiEndpoint,
        page,
        limit: state.pagination.itemsPerPage,
        search: resolvedSearch,
        sortBy: resolvedSortBy,
        sortOrder: resolvedSortOrder,
      });
      if (activeRequestRef.current !== requestId) return;

      dispatch({
        type: 'loadSuccess',
        data: result.items,
        pagination: result.pagination,
        append,
      });
    } catch (error) {
      if (activeRequestRef.current !== requestId) return;

      dispatch({
        type: 'loadError',
        error: error instanceof Error ? error.message : 'Failed to fetch data',
      });
    }
  };

  useEffect(() => {
    latestLoadDataRef.current = loadData;
  });

  useEffect(() => {
    if (!isOpen) {
      loadedSignatureRef.current = null;
      return;
    }

    if (loadedSignatureRef.current === requestSignature) return;
    loadedSignatureRef.current = requestSignature;
    void latestLoadDataRef.current(1);
  }, [isOpen, requestSignature]);

  const handleSortChange = (field: string) => {
    const nextSortBy = field;
    const nextSortOrder =
      state.sortBy === field ? (state.sortOrder === 'desc' ? 'asc' : 'desc') : 'desc';

    dispatch({ type: 'setSort', sortBy: nextSortBy, sortOrder: nextSortOrder });
    void loadData(1, state.searchTerm, false, nextSortBy, nextSortOrder);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="wide">
      <StatsModalBody
        loadData={loadData}
        onSearchTermChange={(value) => dispatch({ type: 'setSearchTerm', value })}
        onSortChange={handleSortChange}
        sortOptions={sortOptions}
        state={state}
        t={t}
        title={title}
        type={type}
      >
        {children}
      </StatsModalBody>
    </Modal>
  );
}
