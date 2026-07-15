'use server';

import { auth, signOut } from '@/auth';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { toBrowserPath } from '@/lib/routing/pathname';
import { ROUTES } from '@/shared/constants/routes';

function readLocale(formData: FormData): Locale {
  const value = formData.get('locale');
  return typeof value === 'string' && locales.includes(value as Locale)
    ? (value as Locale)
    : defaultLocale;
}

export async function logout(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const locale = readLocale(formData);
  await signOut({ redirectTo: toBrowserPath(ROUTES.HOME, locale) });
}
