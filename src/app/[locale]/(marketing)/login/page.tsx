import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoginForm } from '@/components/auth/LoginForm';
import { getTranslations } from 'next-intl/server';
import { isGoogleLoginEnabled } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign In | RinKuzu',
  description: 'Sign in to RinKuzu to continue managing and taking quizzes.',
};

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-neutral-50" />

      <div className="relative flex min-h-screen flex-col justify-center px-4 pt-16 py-8 sm:px-6 sm:pt-20 sm:py-12 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mx-auto sm:w-full sm:max-w-md sm:mb-8">
          <div className="text-center">
            <Link href="/" prefetch={false} className="group inline-flex items-center">
              <div className="flex h-16 items-center justify-center transition-transform group-hover:scale-105 sm:h-20">
                <Image
                  src="/images/auth_logo.png"
                  alt="RinKuzu Logo"
                  width={80}
                  height={80}
                  className="h-16 w-auto object-contain sm:h-20"
                  style={{ width: 'auto' }}
                  unoptimized
                />
              </div>
            </Link>
          </div>

          <div className="mt-6 text-center animate-fadeInUp sm:mt-8">
            <h1 className="mb-2 text-2xl font-semibold text-neutral-900 sm:mb-3 sm:text-4xl">
              {t('welcomeBack')}
            </h1>
            <p className="text-base text-neutral-600 sm:text-lg">{t('signInContinue')}</p>
          </div>
        </div>

        {/* Login Form */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card
            className="animate-fadeInUp border-0 bg-white shadow-lg shadow-neutral-200/60"
            style={{ animationDelay: '200ms' }}
          >
            <CardHeader className="pb-4 text-center">
              <CardTitle size="lg" className="text-neutral-900">
                {t('signIn')}
              </CardTitle>
              <CardDescription className="text-base">{t('enterCredentials')}</CardDescription>
            </CardHeader>

            <LoginForm locale={locale} googleEnabled={isGoogleLoginEnabled} />
          </Card>
        </div>
      </div>
    </div>
  );
}
