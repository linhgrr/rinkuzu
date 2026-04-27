import Link from 'next/link';
import Image from 'next/image';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { HiOutlineLockClosed, HiOutlineShieldCheck } from '@/components/icons';
import { LoginForm } from '@/components/auth/LoginForm';
import { getTranslations } from 'next-intl/server';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-neutral-50" />

      <div className="relative flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 min-h-screen pt-16 sm:pt-20">
        {/* Header */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6 sm:mb-8">
          <div className="text-center">
            <Link href="/" prefetch={false} className="inline-flex items-center group">
              <div className="h-16 sm:h-20 flex items-center justify-center transition-transform group-hover:scale-105">
                <Image
                  src="/images/auth_logo.png"
                  alt="RinKuzu Logo"
                  width={80}
                  height={80}
                  className="h-16 sm:h-20 w-auto object-contain"
                  unoptimized
                />
              </div>
            </Link>
          </div>

          <div className="mt-6 sm:mt-8 text-center animate-fadeInUp">
            <h1 className="text-2xl sm:text-4xl font-bold text-neutral-900 mb-2 sm:mb-3">
              {t('welcomeBack')}
            </h1>
            <p className="text-base sm:text-lg text-neutral-600">{t('signInContinue')}</p>
          </div>
        </div>

        {/* Login Form */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card
            className="border-0 shadow-lg shadow-neutral-100/50 bg-white animate-fadeInUp"
            style={{ animationDelay: '200ms' }}
          >
            <CardHeader className="text-center pb-4">
              <CardTitle size="lg" className="text-neutral-900">
                {t('signIn')}
              </CardTitle>
              <CardDescription className="text-base">{t('enterCredentials')}</CardDescription>
            </CardHeader>

            <LoginForm locale={locale} />
          </Card>

          {/* Additional Info */}
          <div className="mt-8 text-center animate-fadeInUp" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-neutral-500">{t('secureLogin')}</p>
            <div className="flex items-center justify-center mt-4 space-x-4 text-xs text-neutral-400">
              <div className="flex items-center">
                <HiOutlineShieldCheck className="w-4 h-4 mr-1" />
                {t('sslEncrypted')}
              </div>
              <div className="flex items-center">
                <HiOutlineLockClosed className="w-4 h-4 mr-1" />
                {t('privacyProtected')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
