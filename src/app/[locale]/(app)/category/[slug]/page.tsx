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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui/Card';
import Navigation from '@/components/Navigation';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import { PaginationMeta } from '@/types';
import { fetchApiData } from '@/lib/api/client';
import {
  HiOutlineSearch,
  HiOutlineExclamationCircle,
  HiOutlineInbox,
  HiOutlineLightningBolt,
  HiOutlineRefresh,
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

export default function CategoryPage() {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const tQuiz = useTranslations('quiz');
  const { push } = useRouter();
  const encodedSlug = routePathSegment(useRequiredRouteParam('slug'));
  const itemsPerPage = 12;
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // SWR key — changing page or searchTerm triggers automatic re-fetch
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryColor = (color: string) => {
    const colorMap: { [key: string]: string } = {
      blue: 'bg-green-100 text-brand-trust border-green-200',
      green: 'bg-green-100 text-green-700 border-green-200',
      purple: 'bg-violet-100 text-violet-700 border-violet-200',
      red: 'bg-red-100 text-red-700 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      pink: 'bg-pink-100 text-pink-700 border-pink-200',
      gray: 'bg-neutral-100 text-neutral-700 border-neutral-200',
      cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      orange: 'bg-orange-100 text-orange-700 border-orange-200',
      teal: 'bg-green-100 text-brand-trust-hover border-green-200',
    };
    return colorMap[color?.toLowerCase()] || colorMap['purple'];
  };

  const isInitialLoading = isLoading && !category && quizzes.length === 0;

  if (isInitialLoading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <div className="flex justify-center items-center h-64">
            <div className="h-16 flex items-center justify-center mx-auto mb-4 animate-pulse">
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

  if (error && !category && quizzes.length === 0) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <Card variant="bordered" className="p-6 mb-8 border-red-200 bg-red-50">
            <div className="flex items-center text-red-700">
              <HiOutlineExclamationCircle className="size-5 mr-2" />
              {error.message || 'An error occurred while fetching data'}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-x-2 text-sm text-neutral-500 mb-6">
          <Link href="/" className="hover:text-neutral-700">
            {tNav('home')}
          </Link>
          <span>›</span>
          <Link href="/categories" className="hover:text-neutral-700">
            {t('title')}
          </Link>
          <span>›</span>
          <span className="text-neutral-900 font-medium">{category?.name}</span>
        </nav>

        {/* Category Header */}
        {category && (
          <div className="mb-8">
            <div className="flex items-center gap-x-4 mb-4">
              <div
                className="size-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: category.color }}
              >
                {category.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-neutral-900">{category.name}</h1>
                <p className="text-neutral-600 mt-1">
                  {category.description} • {t('quizCount', { count: category.quizCount })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-8">
          <Card variant="glass" className="p-6 backdrop-blur-xl">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder={`${tCommon('search')} ${category?.name} quizzes...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<HiOutlineSearch className="size-5" />}
                  className="w-full"
                />
              </div>
              <Button type="submit" variant="gradient" className="px-8">
                {tCommon('search')}
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
                  {tCommon('cancel')}
                </Button>
              )}
            </form>
          </Card>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-neutral-600">
            Showing {quizzes.length} of {pagination.totalItems} quizzes
            {searchTerm && (
              <span className="ml-2">
                matching <strong>&quot;{searchTerm}&quot;</strong>
              </span>
            )}
            {category && (
              <span className="ml-2">
                in <strong>{category.name}</strong>
              </span>
            )}
          </p>
          {isLoading && <span className="text-sm text-neutral-500">{tCommon('loading')}...</span>}

          {searchTerm && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              className="text-brand-trust hover:text-brand-trust-hover"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Quizzes Grid */}
        {quizzes.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <div className="size-20 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <HiOutlineInbox className="size-8 text-neutral-400" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-3">No quizzes found</h3>
            <p className="text-neutral-600 mb-6">
              {searchTerm
                ? `No quizzes match "${searchTerm}" in ${category?.name}`
                : `No quizzes available in ${category?.name} yet`}
            </p>
            {searchTerm && (
              <Button
                variant="gradient"
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="mx-auto"
              >
                View All {category?.name} Quizzes
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {quizzes.map((quiz, index) => (
              <Card
                key={quiz._id}
                variant="default"
                hover
                className="group animate-fadeInUp"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="purple"
                        size="sm"
                        className={getCategoryColor(quiz.category?.color)}
                      >
                        {quiz.category?.name}
                      </Badge>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {quiz.questionCount} {tQuiz('questions')}
                    </span>
                  </div>
                  <CardTitle size="md" className="group-hover:text-brand-trust transition-colors">
                    {quiz.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-neutral-500 mb-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0">By</span>
                      <UserProfileLink
                        user={quiz.author}
                        avatarSize={28}
                        className="max-w-[65%] text-sm font-medium text-neutral-600"
                        nameClassName="text-sm"
                      />
                    </div>
                    <span>{formatDate(quiz.createdAt)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="gradient"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        push(`/quiz/${quiz.slug}`);
                      }}
                    >
                      <HiOutlineLightningBolt className="size-4 mr-1" />
                      {tQuiz('takeQuiz')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        push(`/quiz/${quiz.slug}/flashcards`);
                      }}
                      className="flex-1"
                    >
                      <HiOutlineRefresh className="size-4 mr-1" />
                      {tQuiz('flashcards')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center mt-12">
            <div className="flex items-center gap-x-2">
              <Button
                variant="outline"
                disabled={pagination.currentPage === 1}
                onClick={() => handlePageChange(pagination.currentPage - 1)}
              >
                {tCommon('previous')}
              </Button>

              {[...Array(pagination.totalPages)].map((_, index) => {
                const page = index + 1;
                return (
                  <Button
                    key={page}
                    variant={pagination.currentPage === page ? 'gradient' : 'outline'}
                    onClick={() => handlePageChange(page)}
                    className="min-w-[40px]"
                  >
                    {page}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => handlePageChange(pagination.currentPage + 1)}
              >
                {tCommon('next')}
              </Button>
            </div>
          </div>
        )}

        {/* Back to Home */}
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
