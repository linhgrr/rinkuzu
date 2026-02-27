'use client';

import { useEffect, useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineShieldCheck } from '@/components/icons';
import { defaultLocale, locales } from '@/i18n/config';

export default function LoginPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(() => {
    const fallback = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
    const raw = searchParams.get('callbackUrl');

    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
      return fallback;
    }

    const pathOnly = raw.split('?')[0];
    const normalizedPath =
      pathOnly.length > 1 && pathOnly.endsWith('/') ? pathOnly.slice(0, -1) : pathOnly;
    const localeRoot = locale === defaultLocale ? '/' : `/${locale}`;
    const localeLoginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
    const localeRegisterPath = locale === defaultLocale ? '/register' : `/${locale}/register`;
    const localeRoots = locales.map((supportedLocale) => `/${supportedLocale}`);
    const blockedCallbacks = new Set([
      '/',
      '/login',
      '/register',
      ...localeRoots,
      localeRoot,
      localeLoginPath,
      localeRegisterPath,
    ]);

    return blockedCallbacks.has(normalizedPath) ? fallback : raw;
  }, [locale, searchParams]);

  useEffect(() => {
    router.prefetch(callbackUrl);
  }, [callbackUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email.trim() || !password.trim()) {
      setError(t('pleaseBothEmailPassword'));
      setLoading(false);
      return;
    }

    let shouldResetLoading = true;

    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(t('invalidEmailPassword'));
      } else if (result?.ok) {
        shouldResetLoading = false;
        router.replace(callbackUrl);
        router.refresh();
        return;
      } else {
        setError(t('loginFailed'));
      }
    } catch (error) {
      console.error('Login exception:', error);
      setError(`${t('loginError')}. ${t('checkConnectionAndRetry')}`);
    } finally {
      if (shouldResetLoading) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-cyan-50 to-blue-50" />

      {/* Floating Elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-purple-500/20 rounded-full blur-xl animate-pulse motion-reduce:animate-none" />
      <div className="absolute top-1/3 right-10 w-24 h-24 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-xl animate-pulse delay-1000 motion-reduce:animate-none" />
      <div className="absolute bottom-10 left-1/3 w-40 h-40 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-xl animate-pulse delay-2000 motion-reduce:animate-none" />

      <div className="relative flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 min-h-screen pt-16 sm:pt-20">
        {/* Header */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6 sm:mb-8">
          <div className="text-center">
            <Link href="/" prefetch={false} className="inline-flex items-center group">
              <div className="h-16 sm:h-20 flex items-center justify-center transition-transform group-hover:scale-105">
                <Image
                  src="https://i.ibb.co/WWGXBZXm/image-removebg-preview.png"
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
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">{t('welcomeBack')}</h1>
            <p className="text-base sm:text-lg text-gray-600">
              {t('signInContinue')}
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card variant="glass" className="backdrop-blur-xl border-white/30 shadow-xl animate-fadeInUp" style={{ animationDelay: '200ms' }}>
            <CardHeader className="text-center pb-4">
              <CardTitle size="lg" className="text-gray-900">{t('signIn')}</CardTitle>
              <CardDescription className="text-base">
                {t('enterCredentials')}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <Card variant="bordered" className="border-red-200 bg-red-50 p-4 animate-fadeInUp" role="alert" aria-live="polite">
                    <div className="flex items-center text-red-700">
                      <HiOutlineExclamationCircle className="w-5 h-5 mr-2 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </Card>
                )}

                <div className="space-y-5">
                  <Input
                    label={t('emailAddress')}
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('enterEmail')}
                    variant="glass"
                    icon={
                      <HiOutlineMail className="w-5 h-5" />
                    }
                  />

                  <Input
                    label={t('password')}
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('enterPassword')}
                    variant="glass"
                    icon={
                      <HiOutlineLockClosed className="w-5 h-5" />
                    }
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    loading={loading}
                    variant="gradient"
                    size="lg"
                    className="w-full"
                  >
                    {loading ? t('signingIn') : t('signInButton')}
                  </Button>
                </div>
              </form>

              {/* Sign Up Link */}
              <div className="mt-8 pt-6 border-t border-white/20">
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    {t('dontHaveAccount')}{' '}
                    <Link
                      href="/register"
                      className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                    >
                      {t('createAccount')}
                    </Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="mt-8 text-center animate-fadeInUp" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-gray-500">
              {t('secureLogin')}
            </p>
            <div className="flex items-center justify-center mt-4 space-x-4 text-xs text-gray-400">
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
