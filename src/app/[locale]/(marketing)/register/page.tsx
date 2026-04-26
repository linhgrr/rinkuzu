'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiCheck,
  HiOutlineShieldCheck,
  HiOutlineInbox,
  HiOutlineHeart
} from '@/components/icons';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t('passwordMinLengthError'));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(t('accountCreatedSuccess'));
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(data.error || t('registrationFailed'));
      }
    } catch (error) {
      setError(`${t('registrationError')}. ${t('checkConnectionAndRetry')}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-neutral-50" />

      <div className="relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 min-h-screen pt-20">
        {/* Header */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center group">
              <div className="h-16 sm:h-20 flex items-center justify-center transition-transform group-hover:scale-105">
                <Image src="/images/auth_logo.png" alt="RinKuzu Logo" width={80} height={80} className="h-16 sm:h-20 w-auto object-contain" />
              </div>
            </Link>
          </div>

          <div className="mt-8 text-center animate-fadeInUp">
            <h1 className="text-4xl font-bold text-neutral-900 mb-3">{t('joinRinKuzu')}</h1>
            <p className="text-lg text-neutral-600">
              {t('createAccountMessage')}
            </p>
          </div>
        </div>

        {/* Register Form */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="border-0 shadow-lg shadow-neutral-100/50 bg-white animate-fadeInUp" style={{ animationDelay: '200ms' }}>
            <CardHeader className="text-center pb-4">
              <CardTitle size="lg" className="text-neutral-900">{t('createAccount')}</CardTitle>
              <CardDescription className="text-base">
                {t('enterDetails')}
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

                {success && (
                  <Card variant="bordered" className="border-green-200 bg-green-50 p-4 animate-fadeInUp" role="status" aria-live="polite">
                    <div className="flex items-center text-green-700">
                      <HiOutlineCheckCircle className="w-5 h-5 mr-2 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium">{success}</span>
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
                    icon={
                      <HiOutlineMail className="w-5 h-5" />
                    }
                  />

                  <Input
                    label={t('password')}
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('enterPassword')}
                    variant="default"
                    icon={
                      <HiOutlineLockClosed className="w-5 h-5" />
                    }
                  />

                  <Input
                    label={t('confirmPassword')}
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('confirmYourPassword')}
                    variant="default"
                    icon={
                      <HiCheck className="w-5 h-5" />
                    }
                  />
                </div>

                {/* Password Requirements */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h4 className="text-sm font-semibold text-neutral-900 mb-2">{t('passwordRequirements')}</h4>
                  <ul className="text-xs text-neutral-700 space-y-1">
                    <li className="flex items-center">
                      <HiCheck className="w-3 h-3 mr-2 text-brand-trust" strokeWidth={3} />
                      {t('passwordMinLength')}
                    </li>
                    <li className="flex items-center">
                      <HiCheck className="w-3 h-3 mr-2 text-brand-trust" strokeWidth={3} />
                      {t('passwordUnique')}
                    </li>
                  </ul>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    loading={loading}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? t('creatingAccount') : t('createAccountButton')}
                  </Button>
                </div>
              </form>

              {/* Sign In Link */}
              <div className="mt-8 pt-6 border-t border-neutral-200">
                <div className="text-center">
                  <p className="text-sm text-neutral-600">
                    {t('alreadyHaveAccount')}{' '}
                    <Link
                      href="/login"
                      className="font-semibold text-brand-trust hover:text-brand-trust-hover transition-colors"
                    >
                      {t('signIn')}
                    </Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="mt-8 text-center animate-fadeInUp" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-neutral-500">
              {t('agreeTerms')}
            </p>
            <div className="flex items-center justify-center mt-4 space-x-6 text-xs text-neutral-400">
              <div className="flex items-center">
                <HiOutlineShieldCheck className="w-4 h-4 mr-1" />
                {t('secureRegistration')}
              </div>
              <div className="flex items-center">
                <HiOutlineInbox className="w-4 h-4 mr-1" />
                {t('noSpamPolicy')}
              </div>
              <div className="flex items-center">
                <HiOutlineHeart className="w-4 h-4 mr-1" />
                {t('freePlan')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 