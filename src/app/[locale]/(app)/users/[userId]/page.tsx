import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UserAvatar } from '@/components/user/UserAvatar';
import { getUserDisplayName } from '@/components/user/user-identity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { buildLocalizedMetadata } from '@/lib/seo';
import { getUserService } from '@/lib/user-factory';
import { isValidMongoObjectId } from '@/lib/mongo-id';
import { formatDate } from '@/lib/formatters';
import { ROUTES } from '@/shared/constants/routes';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { positivePageSchema } from '@/lib/validation/common';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; userId: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/users',
    title: 'Public Profile | RinKuzu',
    description: 'Explore public RinKuzu user profiles and public quizzes.',
  });
}

export default async function PublicUserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; userId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { locale, userId } = await params;
  const rawSearchParams = await searchParams;
  const pageValue = Array.isArray(rawSearchParams.page)
    ? rawSearchParams.page[0]
    : rawSearchParams.page;
  const parsedPage = positivePageSchema.safeParse(pageValue);
  const page = parsedPage.success ? parsedPage.data : 1;

  if (!isValidMongoObjectId(userId)) {
    notFound();
  }

  const [profileResult, t, tQuiz] = await Promise.all([
    getUserService().getPublicProfile(userId, { page }),
    getTranslations({ locale, namespace: 'profile' }),
    getTranslations({ locale, namespace: 'quiz' }),
  ]);

  if (!profileResult.success) {
    if (profileResult.statusCode === 404) {
      notFound();
    }
    throw new Error(profileResult.error);
  }

  const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const { user: profileUser, pagination } = profileResult.data;
  const displayName = getUserDisplayName(profileUser);
  const quizzes = profileResult.data.quizzes.map((quiz) => ({
    ...quiz,
    createdAtIso: quiz.createdAt,
    createdAtLabel: formatDate(quiz.createdAt, {
      locale: dateLocale,
      options: { year: 'numeric', month: 'short', day: 'numeric' },
    }),
  }));

  const joinDate = formatDate(profileUser.createdAt, {
    locale: dateLocale,
    options: { year: 'numeric', month: 'long', day: 'numeric' },
  });

  return (
    <div className="min-h-screen bg-surface-page">
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit overflow-hidden border-line shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <UserAvatar user={profileUser} size={112} />
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-ink">{displayName}</h1>
                <p className="text-sm text-ink-muted">{t('publicProfile')}</p>
              </div>
              <div className="grid w-full gap-3 rounded-2xl bg-surface-warm p-4 text-left text-sm text-ink-muted">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                    {t('joinDate')}
                  </p>
                  <p className="mt-1 font-medium text-ink">{joinDate}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                    {t('publicQuizzes')}
                  </p>
                  <p className="mt-1 font-medium text-ink">
                    {t('publicQuizzesCount', { count: pagination.totalItems })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-line shadow-sm">
              <CardHeader>
                <CardTitle>{t('bioLabel')}</CardTitle>
                <CardDescription>{t('publicProfileDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-ink">
                  {profileUser.bio?.trim() || t('publicProfileNoBio')}
                </p>
              </CardContent>
            </Card>

            <section className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">{t('publicQuizzes')}</h2>
                  <p className="text-sm text-ink-muted">{t('publicProfileQuizDescription')}</p>
                </div>
              </div>

              {quizzes.length === 0 ? (
                <Card className="border-dashed border-line bg-surface/80">
                  <CardContent className="p-8 text-center text-sm text-ink-muted">
                    {t('noPublicQuizzes')}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {quizzes.map((quiz) => (
                    <Card
                      key={quiz.id}
                      className="flex h-full flex-col justify-between border-line shadow-sm"
                    >
                      <CardHeader className="space-y-3">
                        <div>
                          <CardTitle className="line-clamp-2 text-lg">{quiz.title}</CardTitle>
                          <CardDescription className="mt-2 line-clamp-3">
                            {quiz.description || t('noDescription')}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-ink-muted">
                          <span>
                            {quiz.questionCount} {tQuiz('questions')}
                          </span>
                          <time dateTime={quiz.createdAtIso} suppressHydrationWarning>
                            {quiz.createdAtLabel}
                          </time>
                        </div>
                        <Link href={ROUTES.QUIZ.VIEW(quiz.slug)} className="block">
                          <Button className="w-full" variant="gradient">
                            {t('details')}
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {pagination.totalPages > 1 ? (
                <nav
                  aria-label={t('publicQuizPagination')}
                  className="flex items-center justify-center gap-3 pt-2"
                >
                  {pagination.hasPrevPage ? (
                    <Link
                      href={`?page=${pagination.currentPage - 1}`}
                      className="btn btn-secondary"
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                      {t('previousPage')}
                    </Link>
                  ) : null}
                  <span className="text-sm text-ink-muted">
                    {t('pageOf', {
                      page: pagination.currentPage,
                      totalPages: pagination.totalPages,
                    })}
                  </span>
                  {pagination.hasNextPage ? (
                    <Link
                      href={`?page=${pagination.currentPage + 1}`}
                      className="btn btn-secondary"
                    >
                      {t('nextPage')}
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
