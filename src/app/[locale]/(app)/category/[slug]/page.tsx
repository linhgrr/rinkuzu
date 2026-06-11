'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { UserProfileLink } from '@/components/user/UserProfileLink';
import { Input } from '@/components/ui/Input';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import { PaginationMeta } from '@/types';
import { fetchApiData } from '@/lib/api/client';
import {
  HiOutlineExclamationCircle,
  HiOutlineInbox,
  HiOutlineLightningBolt,
  HiOutlineRefresh,
  HiOutlineSearch,
} from '@/components/icons';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    _id: string;
    name: string;
    color: string;
  };
  author: {
    _id: string;
    email: string;
    name?: string;
    displayName?: string;
    avatar?: string;
  };
  createdAt: string;
  questionCount: number;
  status: string;
}

interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
  quizCount: number;
}

const itemsPerPage = 12;

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getCategoryColor(color: string) {
  const colorMap: Record<string, string> = {
    blue: 'bg-green-100 text-accent border-green-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-violet-100 text-violet-700 border-violet-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    pink: 'bg-pink-100 text-pink-700 border-pink-200',
    gray: 'bg-surface-warm text-ink border-line',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    teal: 'bg-green-100 text-accent-hover border-green-200',
  };
  return colorMap[color?.toLowerCase()] || colorMap['purple'];
}

function CategoryLoadingState() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <div className="flex h-64 items-center justify-center">
          <div className="mx-auto mb-4 flex h-16 items-center justify-center animate-pulse">
            <Image
              src="/images/auth_logo.png"
              alt="RinKuzu Logo"
              width={64}
              height={64}
              className="h-16 w-auto object-contain"
              unoptimized
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <Card variant="bordered" className="mb-8 border-red-200 bg-red-50 p-6">
          <div className="flex items-center text-red-700">
            <HiOutlineExclamationCircle className="mr-2 size-5" />
            {message}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CategoryBreadcrumbs({
  categoryName,
  categoriesLabel,
  homeLabel,
}: {
  categoryName?: string;
  categoriesLabel: string;
  homeLabel: string;
}) {
  return (
    <nav className="mb-6 flex items-center gap-x-2 text-sm text-ink-muted">
      <Link href="/" className="hover:text-ink">
        {homeLabel}
      </Link>
      <span>›</span>
      <Link href="/categories" className="hover:text-ink">
        {categoriesLabel}
      </Link>
      <span>›</span>
      <span className="font-medium text-ink">{categoryName}</span>
    </nav>
  );
}

function CategoryHeader({
  category,
  quizCountLabel,
}: {
  category: Category;
  quizCountLabel: string;
}) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-x-4">
        <div
          className="flex size-12 items-center justify-center rounded-full text-xl font-bold text-white"
          style={{ backgroundColor: category.color }}
        >
          {category.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-ink">{category.name}</h1>
          <p className="mt-1 text-ink-muted">
            {category.description} • {quizCountLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function CategorySearchCard({
  categoryName,
  searchTerm,
  searchLabel,
  cancelLabel,
  onSearchTermChange,
  onSubmit,
  onClear,
}: {
  categoryName?: string;
  searchTerm: string;
  searchLabel: string;
  cancelLabel: string;
  onSearchTermChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-8">
      <Card variant="glass" className="p-6 backdrop-blur-xl">
        <form onSubmit={onSubmit} className="flex gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder={`${searchLabel} ${categoryName} quizzes...`}
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              icon={<HiOutlineSearch className="size-5" />}
              className="w-full"
            />
          </div>
          <Button type="submit" variant="gradient" className="px-8">
            {searchLabel}
          </Button>
          {searchTerm ? (
            <Button type="button" variant="outline" onClick={onClear}>
              {cancelLabel}
            </Button>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

function CategoryResultsBar({
  category,
  isLoading,
  pagination,
  quizzesCount,
  searchTerm,
  clearLabel,
  loadingLabel,
  onClear,
}: {
  category: Category | null;
  isLoading: boolean;
  pagination: PaginationMeta;
  quizzesCount: number;
  searchTerm: string;
  clearLabel: string;
  loadingLabel: string;
  onClear: () => void;
}) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <p className="text-ink-muted">
        Showing {quizzesCount} of {pagination.totalItems} quizzes
        {searchTerm ? (
          <span className="ml-2">
            matching <strong>&quot;{searchTerm}&quot;</strong>
          </span>
        ) : null}
        {category ? (
          <span className="ml-2">
            in <strong>{category.name}</strong>
          </span>
        ) : null}
      </p>
      {isLoading ? <span className="text-sm text-ink-muted">{loadingLabel}...</span> : null}
      {searchTerm ? (
        <Button variant="ghost" onClick={onClear} className="text-accent hover:text-accent-hover">
          {clearLabel}
        </Button>
      ) : null}
    </div>
  );
}

function CategoryQuizCard({
  index,
  quiz,
  questionsLabel,
  takeQuizLabel,
  flashcardsLabel,
  onTakeQuiz,
  onOpenFlashcards,
}: {
  index: number;
  quiz: Quiz;
  questionsLabel: string;
  takeQuizLabel: string;
  flashcardsLabel: string;
  onTakeQuiz: (slug: string) => void;
  onOpenFlashcards: (slug: string) => void;
}) {
  return (
    <Card
      variant="default"
      hover
      className="group animate-fadeInUp"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardHeader>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="purple" size="sm" className={getCategoryColor(quiz.category?.color)}>
              {quiz.category?.name}
            </Badge>
          </div>
          <span className="text-xs text-ink-muted">
            {quiz.questionCount} {questionsLabel}
          </span>
        </div>
        <CardTitle size="md" className="transition-colors group-hover:text-accent">
          {quiz.title}
        </CardTitle>
        <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between text-sm text-ink-muted">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0">By</span>
            <UserProfileLink
              user={quiz.author}
              avatarSize={28}
              className="max-w-[65%] text-sm font-medium text-ink-muted"
              nameClassName="text-sm"
            />
          </div>
          <span>{formatDate(quiz.createdAt)}</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="gradient"
            size="sm"
            className="flex-1"
            onClick={(event) => {
              event.stopPropagation();
              onTakeQuiz(quiz.slug);
            }}
          >
            <HiOutlineLightningBolt className="mr-1 size-4" />
            {takeQuizLabel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(event) => {
              event.stopPropagation();
              onOpenFlashcards(quiz.slug);
            }}
          >
            <HiOutlineRefresh className="mr-1 size-4" />
            {flashcardsLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyCategoryQuizzesState({
  categoryName,
  searchTerm,
  clearActionLabel,
  onClear,
}: {
  categoryName?: string;
  searchTerm: string;
  clearActionLabel: string;
  onClear: () => void;
}) {
  return (
    <Card variant="glass" className="p-12 text-center">
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-surface-warm">
        <HiOutlineInbox className="size-8 text-ink-muted" />
      </div>
      <h3 className="mb-3 text-xl font-semibold text-ink">No quizzes found</h3>
      <p className="mb-6 text-ink-muted">
        {searchTerm
          ? `No quizzes match "${searchTerm}" in ${categoryName}`
          : `No quizzes available in ${categoryName} yet`}
      </p>
      {searchTerm ? (
        <Button variant="gradient" onClick={onClear} className="mx-auto">
          {clearActionLabel}
        </Button>
      ) : null}
    </Card>
  );
}

function CategoryPagination({
  currentPage,
  totalPages,
  nextLabel,
  previousLabel,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  nextLabel: string;
  previousLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-12 flex justify-center">
      <div className="flex items-center gap-x-2">
        <Button
          variant="outline"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          {previousLabel}
        </Button>

        {Array.from({ length: totalPages }, (_, index) => {
          const page = index + 1;
          return (
            <Button
              key={page}
              variant={currentPage === page ? 'gradient' : 'outline'}
              onClick={() => onPageChange(page)}
              className="min-w-[40px]"
            >
              {page}
            </Button>
          );
        })}

        <Button
          variant="outline"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

export default function CategoryPage() {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const tQuiz = useTranslations('quiz');
  const { push } = useRouter();
  const encodedSlug = routePathSegment(useRequiredRouteParam('slug'));
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: itemsPerPage.toString(),
  });
  if (searchTerm.trim()) {
    queryParams.append('search', searchTerm.trim());
  }

  const { data, error, isLoading } = useSWR(
    `/api/categories/${encodedSlug}?${queryParams}`,
    fetchApiData<{
      category: Category;
      quizzes: Quiz[];
      pagination: PaginationMeta;
    }>,
  );

  const category = data?.category ?? null;
  const quizzes = data?.quizzes ?? [];
  const pagination = data?.pagination ?? {
    currentPage: page,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPage(1);
  };

  const isInitialLoading = isLoading && !category && quizzes.length === 0;
  if (isInitialLoading) {
    return <CategoryLoadingState />;
  }

  if (error && !category && quizzes.length === 0) {
    return (
      <CategoryErrorState message={error.message || 'An error occurred while fetching data'} />
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <CategoryBreadcrumbs
          categoryName={category?.name}
          categoriesLabel={t('title')}
          homeLabel={tNav('home')}
        />

        {category ? (
          <CategoryHeader
            category={category}
            quizCountLabel={t('quizCount', { count: category.quizCount })}
          />
        ) : null}

        <CategorySearchCard
          categoryName={category?.name}
          searchTerm={searchTerm}
          searchLabel={tCommon('search')}
          cancelLabel={tCommon('cancel')}
          onSearchTermChange={setSearchTerm}
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
          onClear={clearFilters}
        />

        <CategoryResultsBar
          category={category}
          isLoading={isLoading}
          pagination={pagination}
          quizzesCount={quizzes.length}
          searchTerm={searchTerm}
          clearLabel="Clear filters"
          loadingLabel={tCommon('loading')}
          onClear={clearFilters}
        />

        {quizzes.length === 0 ? (
          <EmptyCategoryQuizzesState
            categoryName={category?.name}
            searchTerm={searchTerm}
            clearActionLabel={`View All ${category?.name} Quizzes`}
            onClear={clearFilters}
          />
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz, index) => (
              <CategoryQuizCard
                key={quiz._id}
                index={index}
                quiz={quiz}
                questionsLabel={tQuiz('questions')}
                takeQuizLabel={tQuiz('takeQuiz')}
                flashcardsLabel={tQuiz('flashcards')}
                onTakeQuiz={(slug) => push(`/quiz/${slug}`)}
                onOpenFlashcards={(slug) => push(`/quiz/${slug}/flashcards`)}
              />
            ))}
          </div>
        )}

        <CategoryPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          previousLabel={tCommon('previous')}
          nextLabel={tCommon('next')}
          onPageChange={setPage}
        />

        <div className="mt-12 text-center">
          <Link href="/categories">
            <Button variant="outline">
              ← {tCommon('back')} to All {t('title')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
