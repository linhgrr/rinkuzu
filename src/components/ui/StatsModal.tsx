'use client';

import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserProfileLink } from '@/components/user/UserProfileLink';
import { fetchApiData } from '@/lib/api/client';
import Pagination from './Pagination';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'categories' | 'creators' | 'activity';
  apiEndpoint: string;
  children?: React.ReactNode;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface StatsModalPayload {
  pagination: PaginationData;
  categories?: any[];
  creators?: any[];
  activities?: any[];
  data?: any[];
}

interface SortOption {
  value: string;
  label: string;
}

interface StatsModalState {
  data: any[];
  loading: boolean;
  error: string;
  pagination: PaginationData;
  searchTerm: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

type StatsModalAction =
  | { type: 'loadStart'; clearError: boolean }
  | { type: 'loadSuccess'; data: any[]; pagination: PaginationData; append: boolean }
  | { type: 'loadError'; error: string }
  | { type: 'setSearchTerm'; value: string }
  | { type: 'setSort'; sortBy: string; sortOrder: 'asc' | 'desc' };

const initialPagination: PaginationData = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
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

function getDataKey(type: StatsModalProps['type']) {
  switch (type) {
    case 'categories':
      return 'categories';
    case 'creators':
      return 'creators';
    case 'activity':
      return 'activities';
    default:
      return 'data';
  }
}

function getSortOptions(type: StatsModalProps['type'], t: (key: string) => string): SortOption[] {
  switch (type) {
    case 'categories':
      return [
        { value: 'quizCount', label: t('quizCount') },
        { value: 'name', label: t('name') },
        { value: 'createdAt', label: t('createdAt') },
      ];
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

function formatDateValue(dateString: string) {
  return new Date(dateString).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CategoryItem({
  category,
  index,
  page,
  limit,
  t,
}: {
  category: any;
  index: number;
  page: number;
  limit: number;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
      <div className="flex items-center gap-x-4">
        <span className="text-sm font-medium text-neutral-500">
          #{index + 1 + (page - 1) * limit}
        </span>
        <div className="size-4 rounded-full" style={{ backgroundColor: category.color }} />
        <div>
          <h4 className="font-medium text-neutral-900">{category.name}</h4>
          <p className="text-sm text-neutral-600">{category.description}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">
          {category.totalQuizzes || category.quizCount} quiz
        </div>
        <div className="text-xs text-neutral-500">
          {category.publishedQuizzes} {t('published')} • {category.totalQuestions}{' '}
          {t('questionsCount')}
        </div>
        <div className="text-xs text-neutral-400">
          {category.isActive ? (
            <span className="text-green-600">{t('active')}</span>
          ) : (
            <span className="text-red-600">{t('inactive')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CreatorItem({
  creator,
  index,
  page,
  limit,
  t,
}: {
  creator: any;
  index: number;
  page: number;
  limit: number;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
      <div className="flex items-center gap-x-4">
        <span className="text-sm font-medium text-neutral-500">
          #{index + 1 + (page - 1) * limit}
        </span>
        <div className="size-8 bg-gradient-to-br from-green-400 to-brand-trust rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">{creator.email[0].toUpperCase()}</span>
        </div>
        <div>
          <h4 className="font-medium text-neutral-900">{creator.email}</h4>
          <div className="flex items-center gap-x-2 text-xs text-neutral-500">
            <span>
              {t('joined')}: {formatDateValue(creator.joinedAt)}
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
          {creator.totalQuestions} {t('questionsCount')} • {Math.round(creator.successRate || 0)}%{' '}
          {t('successRate')}
        </div>
        <div className="text-xs text-neutral-400">
          <span className="text-green-600">
            {creator.publishedQuizzes} {t('published')}
          </span>{' '}
          •
          <span className="text-yellow-600 ml-1">
            {creator.pendingQuizzes} {t('pendingApproval')}
          </span>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ activity, t }: { activity: any; t: (key: string) => string }) {
  const { type: activityType, data: activityData, date } = activity;
  const activityKey =
    activityData.email ||
    activityData.title ||
    activityData.quiz?.title ||
    `${activityType}-${date}`;

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
              {t('newUser')}: {activityData.email}
            </h4>
            <p className="text-sm text-neutral-600">{t('registered')}</p>
          </div>
        )}
        {activityType === 'quiz' && (
          <div>
            <h4 className="font-medium text-neutral-900">{activityData.title}</h4>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
              <span className="shrink-0">{t('by')}</span>
              <UserProfileLink
                user={activityData.author || {}}
                avatarSize={20}
                className="max-w-[220px] text-sm text-neutral-600"
                nameClassName="text-sm"
              />
              <span>•</span>
              <span>{activityData.category?.name}</span>
              <span>•</span>
              <span>
                {activityData.questionCount} {t('questionsCount')}
              </span>
            </div>
          </div>
        )}
        {activityType === 'attempt' && (
          <div>
            <h4 className="font-medium text-neutral-900">{activityData.quiz?.title}</h4>
            <p className="text-sm text-neutral-600">
              {activityData.user?.email || t('anonymous')} • Score: {activityData.score}% •{' '}
              {activityData.answeredQuestions} {t('answeredQuestions')}
            </p>
          </div>
        )}
        <p className="text-xs text-neutral-400">{formatDateValue(date)}</p>
      </div>

      {activityType === 'quiz' && (
        <span
          className={`px-2 py-1 rounded text-xs ${
            activityData.status === 'published'
              ? 'bg-green-100 text-green-800'
              : activityData.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
          }`}
        >
          {activityData.status}
        </span>
      )}

      {activityType === 'attempt' && (
        <div className="text-right">
          <div
            className={`text-sm font-medium ${
              activityData.score >= 80
                ? 'text-green-600'
                : activityData.score >= 60
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {activityData.score}%
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
  page,
  limit,
  t,
  type,
}: {
  data: any[];
  error: string;
  loading: boolean;
  onRetry: () => void;
  page: number;
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
          case 'categories':
            return (
              <CategoryItem
                key={item._id || index}
                category={item}
                index={index}
                page={page}
                limit={limit}
                t={t}
              />
            );
          case 'creators':
            return (
              <CreatorItem
                key={item._id || index}
                creator={item}
                index={index}
                page={page}
                limit={limit}
                t={t}
              />
            );
          case 'activity':
            return <ActivityItem key={item._id || item.date || index} activity={item} t={t} />;
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
  requestSignature: string;
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
  requestSignature,
  sortOptions,
  state,
  t,
  title,
  type,
}: StatsModalBodyProps) {
  useEffect(() => {
    void loadData(1);
  }, [loadData, requestSignature]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadData(1, state.searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    void loadData(newPage);
  };

  const handleLoadMore = () => {
    if (state.pagination.hasNext) {
      void loadData(state.pagination.page + 1, state.searchTerm, true);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900 mb-2">{title}</h2>
        <p className="text-neutral-600">
          {t('showing', { count: state.data.length, total: state.pagination.total })}
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
          page={state.pagination.page}
          limit={state.pagination.limit}
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
          {type === 'activity' && state.pagination.hasNext && (
            <Button onClick={handleLoadMore} variant="outline" disabled={state.loading} size="sm">
              {t('loadMore')}
            </Button>
          )}
        </div>

        {type !== 'activity' && state.pagination.totalPages > 1 && (
          <Pagination
            currentPage={state.pagination.page}
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

  const loadData = async (
    page = 1,
    search = state.searchTerm,
    append = false,
    sortBy = state.sortBy,
    sortOrder = state.sortOrder,
  ) => {
    dispatch({ type: 'loadStart', clearError: !append });

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: state.pagination.limit.toString(),
        ...(search && { search }),
        ...(sortBy && { sortBy }),
        sortOrder,
      });
      const result = await fetchApiData<StatsModalPayload>(
        `${apiEndpoint}${apiEndpoint.includes('?') ? '&' : '?'}${params}`,
      );
      const nextData = result[getDataKey(type)] || result.activities || [];

      dispatch({
        type: 'loadSuccess',
        data: nextData,
        pagination: result.pagination,
        append,
      });
    } catch (error) {
      dispatch({
        type: 'loadError',
        error: error instanceof Error ? error.message : 'Failed to fetch data',
      });
    }
  };

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
        requestSignature={requestSignature}
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
