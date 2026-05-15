'use client';

import { useReducer } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { fetchApiResponse } from '@/lib/api/client';
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
  HiOutlineHeart,
} from '@/components/icons';

interface RegisterState {
  email: string;
  password: string;
  confirmPassword: string;
  loading: boolean;
  error: string;
  success: string;
}

type RegisterAction =
  | { type: 'setField'; field: 'email' | 'password' | 'confirmPassword'; value: string }
  | { type: 'setLoading'; value: boolean }
  | { type: 'setError'; value: string }
  | { type: 'setSuccess'; value: string }
  | { type: 'resetMessages' };

const initialState: RegisterState = {
  email: '',
  password: '',
  confirmPassword: '',
  loading: false,
  error: '',
  success: '',
};

function registerReducer(state: RegisterState, action: RegisterAction): RegisterState {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'setLoading':
      return { ...state, loading: action.value };
    case 'setError':
      return { ...state, error: action.value };
    case 'setSuccess':
      return { ...state, success: action.value };
    case 'resetMessages':
      return { ...state, error: '', success: '' };
    default:
      return state;
  }
}

export function RegisterPageClient() {
  const t = useTranslations('auth');
  const { push } = useRouter();
  const [state, dispatch] = useReducer(registerReducer, initialState);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'setLoading', value: true });
    dispatch({ type: 'resetMessages' });

    if (state.password !== state.confirmPassword) {
      dispatch({ type: 'setError', value: t('passwordsDoNotMatch') });
      dispatch({ type: 'setLoading', value: false });
      return;
    }

    if (state.password.length < 8) {
      dispatch({ type: 'setError', value: t('passwordMinLengthError') });
      dispatch({ type: 'setLoading', value: false });
      return;
    }

    try {
      const data = await fetchApiResponse<
        { id: string; email: string; role: string },
        { message?: string }
      >('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: state.email,
          password: state.password,
        }),
      });
      dispatch({ type: 'setSuccess', value: data.message || t('accountCreatedSuccess') });
      setTimeout(() => {
        push('/login');
      }, 2000);
    } catch (error) {
      dispatch({
        type: 'setError',
        value: error instanceof Error ? error.message : t('registrationFailed'),
      });
    } finally {
      dispatch({ type: 'setLoading', value: false });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-neutral-50" />

      <div className="relative flex min-h-screen flex-col justify-center pt-20 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <Link href="/" className="group inline-flex items-center">
              <div className="flex h-16 items-center justify-center transition-transform group-hover:scale-105 sm:h-20">
                <Image
                  src="/images/auth_logo.png"
                  alt="RinKuzu Logo"
                  width={80}
                  height={80}
                  className="h-16 w-auto object-contain sm:h-20"
                  style={{ width: 'auto' }}
                />
              </div>
            </Link>
          </div>

          <div className="mt-8 text-center animate-fadeInUp">
            <h1 className="mb-3 text-4xl font-semibold text-neutral-900">{t('joinRinKuzu')}</h1>
            <p className="text-lg text-neutral-600">{t('createAccountMessage')}</p>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card
            className="animate-fadeInUp border-0 bg-white shadow-lg shadow-neutral-200/60"
            style={{ animationDelay: '200ms' }}
          >
            <CardHeader className="pb-4 text-center">
              <CardTitle size="lg" className="text-neutral-900">
                {t('createAccount')}
              </CardTitle>
              <CardDescription className="text-base">{t('enterDetails')}</CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              <form className="space-y-6" onSubmit={handleSubmit}>
                {state.error && (
                  <Card
                    variant="bordered"
                    className="animate-fadeInUp border-red-200 bg-red-50 p-4"
                    role="alert"
                    aria-live="polite"
                  >
                    <div className="flex items-center text-red-700">
                      <HiOutlineExclamationCircle
                        className="mr-2 size-5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium">{state.error}</span>
                    </div>
                  </Card>
                )}

                {state.success && (
                  <Card
                    variant="bordered"
                    className="animate-fadeInUp border-emerald-200 bg-emerald-50 p-4"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center text-emerald-700">
                      <HiOutlineCheckCircle
                        className="mr-2 size-5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium">{state.success}</span>
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
                    value={state.email}
                    onChange={(e) =>
                      dispatch({ type: 'setField', field: 'email', value: e.target.value })
                    }
                    placeholder={t('enterEmail')}
                    icon={<HiOutlineMail className="size-5" />}
                  />

                  <Input
                    label={t('password')}
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={state.password}
                    onChange={(e) =>
                      dispatch({ type: 'setField', field: 'password', value: e.target.value })
                    }
                    placeholder={t('enterPassword')}
                    icon={<HiOutlineLockClosed className="size-5" />}
                  />

                  <Input
                    label={t('confirmPassword')}
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={state.confirmPassword}
                    onChange={(e) =>
                      dispatch({
                        type: 'setField',
                        field: 'confirmPassword',
                        value: e.target.value,
                      })
                    }
                    placeholder={t('confirmYourPassword')}
                    icon={<HiCheck className="size-5" />}
                  />
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-blue-900">
                    {t('passwordRequirements')}
                  </h4>
                  <ul className="space-y-1 text-xs text-blue-800">
                    <li className="flex items-center">
                      <HiCheck className="mr-2 size-3 text-blue-600" strokeWidth={3} />
                      {t('passwordMinLength')}
                    </li>
                    <li className="flex items-center">
                      <HiCheck className="mr-2 size-3 text-blue-600" strokeWidth={3} />
                      {t('passwordUnique')}
                    </li>
                  </ul>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    loading={state.loading}
                    size="lg"
                    className="w-full border-0 bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                  >
                    {state.loading ? t('creatingAccount') : t('createAccountButton')}
                  </Button>
                </div>
              </form>

              <div className="mt-8 border-t border-neutral-100 pt-6">
                <div className="text-center">
                  <p className="text-sm text-neutral-600">
                    {t('alreadyHaveAccount')}{' '}
                    <Link
                      href="/login"
                      className="font-semibold text-teal-600 transition-colors hover:text-teal-700"
                    >
                      {t('signIn')}
                    </Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center animate-fadeInUp" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-neutral-500">{t('agreeTerms')}</p>
            <div className="mt-4 flex items-center justify-center gap-x-6 text-xs text-neutral-400">
              <div className="flex items-center">
                <HiOutlineShieldCheck className="mr-1 size-4" />
                {t('secureRegistration')}
              </div>
              <div className="flex items-center">
                <HiOutlineInbox className="mr-1 size-4" />
                {t('noSpamPolicy')}
              </div>
              <div className="flex items-center">
                <HiOutlineHeart className="mr-1 size-4" />
                {t('freePlan')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
