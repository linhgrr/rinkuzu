'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { defaultLocale } from '@/i18n/config';

type AuthMode = 'login' | 'signup';

interface AuthShellProps {
  locale: string;
  googleEnabled?: boolean;
}

const EASE = [0.25, 0.1, 0.25, 1] as const;

function AuthFormFallback() {
  return (
    <div className="space-y-4 py-6" aria-hidden="true">
      <div className="h-12 rounded-full bg-surface-warm" />
      <div className="h-12 rounded-full bg-surface-warm" />
      <div className="h-12 rounded-full bg-surface-warm" />
    </div>
  );
}

const LoginForm = dynamic(
  () => import('@/components/auth/LoginForm').then((mod) => mod.LoginForm),
  {
    loading: AuthFormFallback,
  },
);

const RegisterForm = dynamic(
  () => import('@/components/auth/RegisterForm').then((mod) => mod.RegisterForm),
  {
    loading: AuthFormFallback,
  },
);

export function AuthShell({ locale, googleEnabled }: AuthShellProps) {
  const t = useTranslations('auth');
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();

  // Mode is derived from the URL. This shell lives in the shared (auth)
  // layout, so navigating between /login and /register does NOT remount it —
  // Next preserves the layout and only swaps the page segment. router.push
  // updates the URL; usePathname re-renders this component with the new mode,
  // and framer-motion animates the difference.
  const mode: AuthMode = pathname.includes('/register') ? 'signup' : 'login';

  const switchTo = (next: AuthMode) => {
    const segment = next === 'login' ? '/login' : '/register';
    const url = locale === defaultLocale ? segment : `/${locale}${segment}`;
    router.push(url);
  };

  const isLogin = mode === 'login';
  const duration = reduceMotion ? 0 : 0.35;

  // Mascot panel sits left for login, right for signup.
  const panelOrder = isLogin ? 'lg:order-1' : 'lg:order-2';
  const panelRounded = isLogin ? 'lg:rounded-r-3xl' : 'lg:rounded-l-3xl';
  const formOrder = isLogin ? 'lg:order-2' : 'lg:order-1';

  const formVariants = {
    initial: { opacity: 0, x: reduceMotion ? 0 : isLogin ? 24 : -24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: reduceMotion ? 0 : isLogin ? -24 : 24 },
  };

  return (
    <div className="flex min-h-screen w-full bg-surface-page">
      {/* Visual panel — slides side to side via layout animation */}
      <motion.div
        layout
        transition={{ duration, ease: EASE }}
        className={`relative hidden h-screen aspect-[3/4] shrink-0 overflow-hidden lg:block ${panelOrder} ${panelRounded}`}
      >
        <Image
          src="/images/auth_panel.png"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-contain"
          aria-hidden="true"
          unoptimized
        />
      </motion.div>

      {/* Form panel */}
      <div
        className={`flex w-full flex-col items-center justify-center px-4 py-12 sm:px-6 lg:flex-1 lg:px-8 ${formOrder}`}
      >
        <div className="w-full max-w-md">
          {/* Logo — mobile only (panel hidden) */}
          <Link
            href="/"
            prefetch={false}
            className="mb-8 inline-flex items-center justify-center lg:hidden"
          >
            <Image
              src="/images/auth_logo.png"
              alt="RinKuzu Logo"
              width={56}
              height={56}
              className="h-12 w-auto object-contain"
              style={{ width: 'auto' }}
              unoptimized
            />
          </Link>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              variants={formVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration, ease: EASE }}
            >
              <div className="mb-8">
                <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
                  {isLogin ? t('signIn') : t('createAccount')}
                </h1>
                <p className="mt-3 text-body text-ink-muted">
                  {isLogin ? t('enterCredentials') : t('enterDetails')}
                </p>
              </div>

              {isLogin ? (
                <LoginForm
                  locale={locale}
                  googleEnabled={googleEnabled}
                  onSwitchMode={() => switchTo('signup')}
                />
              ) : (
                <RegisterForm
                  locale={locale}
                  googleEnabled={googleEnabled}
                  onSwitchMode={() => switchTo('login')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
