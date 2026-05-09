'use client';

import { useEffect, useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineExclamationCircle } from '@/components/icons';
import { defaultLocale, locales } from '@/i18n/config';

interface LoginFormProps {
  locale: string;
}

export function LoginForm({ locale }: LoginFormProps) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    <CardContent className="pt-0">
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <Card
            variant="bordered"
            className="border-red-200 bg-red-50 p-4 animate-fadeInUp"
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-center text-red-700">
              <HiOutlineExclamationCircle
                className="w-5 h-5 mr-2 flex-shrink-0"
                aria-hidden="true"
              />
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
            variant="default"
            icon={<HiOutlineMail className="w-5 h-5" />}
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
            variant="default"
            icon={<HiOutlineLockClosed className="w-5 h-5" />}
          />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            loading={loading}
            size="lg"
            className="w-full bg-teal-600 text-white hover:bg-teal-700 shadow-sm border-0"
          >
            {loading ? t('signingIn') : t('signInButton')}
          </Button>
        </div>
      </form>

      {/* Sign Up Link */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {t('dontHaveAccount')}{' '}
            <Link
              href="/register"
              className="font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              {t('createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </CardContent>
  );
}
