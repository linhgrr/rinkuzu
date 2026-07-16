import 'server-only';

import { redirect } from 'next/navigation';

import { toBrowserPath } from './pathname';

export function redirectToLocalizedPath(pathWithoutLocale: string, locale: string): never {
  redirect(toBrowserPath(pathWithoutLocale, locale));
}
