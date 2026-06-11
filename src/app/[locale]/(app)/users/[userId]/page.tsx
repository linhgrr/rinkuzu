import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Types } from 'mongoose';
import { UserAvatar } from '@/components/user/UserAvatar';
import { type UserIdentity, getUserDisplayName } from '@/components/user/user-identity';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import connectDB from '@/lib/mongoose';
import { buildLocalizedMetadata } from '@/lib/seo';
import Quiz from '@/models/Quiz';
import User from '@/models/User';
import { ROUTES } from '@/shared/constants';

const publicProfileLongDateFormatters = {
  en: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  vi: new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
};

const publicProfileShortDateFormatters = {
  en: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }),
  vi: new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }),
};

export const dynamic = 'force-dynamic';

interface PublicQuizRecord {
  _id: string;
  title: string;
  description?: string;
  slug: string;
  createdAt: Date;
  questions?: Array<unknown>;
  category?: {
    name: string;
    color: string;
  } | null;
}

function getCategoryBadgeVariant(color: string) {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'default'> = {
    blue: 'info',
    green: 'success',
    yellow: 'warning',
    red: 'danger',
    purple: 'purple',
  };

  return map[color?.toLowerCase()] || 'default';
}

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
    description: 'Explore public RinKuzu user profiles and published quizzes.',
  });
}

export default async function PublicUserProfilePage({
  params,
}: {
  params: Promise<{ locale: string; userId: string }>;
}) {
  const { locale, userId } = await params;

  if (!Types.ObjectId.isValid(userId)) {
    notFound();
  }

  await connectDB();

  const [user, rawQuizzes, t, tQuiz] = await Promise.all([
    User.findById(userId).select('email name displayName bio avatar createdAt').lean(),
    Quiz.find({
      author: userId,
      status: 'published',
      isPrivate: false,
    })
      .populate('category', 'name color')
      .select('title description slug category createdAt questions')
      .sort({ createdAt: -1 })
      .lean(),
    getTranslations({ locale, namespace: 'profile' }),
    getTranslations({ locale, namespace: 'quiz' }),
  ]);

  if (!user) {
    notFound();
  }

  const localeKey = locale === 'vi' ? 'vi' : 'en';
  const profileUser = user as unknown as UserIdentity & { bio?: string; createdAt?: Date | string };
  const displayName = getUserDisplayName(profileUser);
  const publicQuizRecords = rawQuizzes as unknown as PublicQuizRecord[];
  const quizzes = publicQuizRecords.map((quiz) => ({
    _id: String(quiz._id),
    title: quiz.title,
    description: quiz.description || '',
    slug: quiz.slug,
    createdAt: quiz.createdAt,
    createdAtIso: new Date(quiz.createdAt).toISOString(),
    createdAtLabel: publicProfileShortDateFormatters[localeKey].format(new Date(quiz.createdAt)),
    questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
    category: quiz.category
      ? {
          name: quiz.category.name,
          color: quiz.category.color,
        }
      : null,
  }));

  const joinDate = publicProfileLongDateFormatters[localeKey].format(
    new Date(profileUser.createdAt || new Date()),
  );

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
                    {t('publishedQuizzes')}
                  </p>
                  <p className="mt-1 font-medium text-ink">
                    {t('publishedQuizzesCount', { count: quizzes.length })}
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
                  <h2 className="text-xl font-semibold text-ink">{t('publishedQuizzes')}</h2>
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
                      key={quiz._id}
                      className="flex h-full flex-col justify-between border-line shadow-sm"
                    >
                      <CardHeader className="space-y-3">
                        {quiz.category && (
                          <Badge
                            variant={getCategoryBadgeVariant(quiz.category.color)}
                            className="w-fit"
                          >
                            {quiz.category.name}
                          </Badge>
                        )}
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
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
