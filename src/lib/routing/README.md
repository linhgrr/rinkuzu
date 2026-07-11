# Path handling contract (Next.js + next-intl)

This project uses **next-intl** with `localePrefix: 'always'` (`vi` → `/vi/...`, `en` → `/en/...`).

Official refs:

- [next-intl Navigation APIs](https://next-intl.dev/docs/routing/navigation)
- [next-intl Routing setup](https://next-intl.dev/docs/routing/setup)
- [getPathname](https://next-intl.dev/docs/routing/navigation#getpathname)

## Two path forms

| Form                     | Shape                                             | Use with                                                                        |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| **App href** (canonical) | Unprefixed: `/dashboard`, `/login`                | `Link`, `useRouter`, `redirect({ href })`, `ROUTES.*`, auth `callbackUrl` query |
| **Browser URL**          | Always prefixed: `/vi/dashboard`, `/en/dashboard` | `NextResponse.redirect`, NextAuth `callbackUrl`, emails, absolute links         |

**Never** hand-prefix for in-app navigation:

```ts
// ❌ double locale: /en/en/dashboard
router.push(`/${locale}/dashboard`);

// ✅
router.push(ROUTES.DASHBOARD);
// or
router.push('/dashboard');
```

## Helpers

| Helper                                      | Role                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `ROUTES`                                    | Named app hrefs (always unprefixed)                                         |
| `toIntlHref(href)`                          | Strip accidental locale prefix before next-intl nav                         |
| `toBrowserPath(href, locale)`               | Build final browser path (`always` prefix; pure helper)                     |
| `getPathname` (`@/i18n/navigation`)         | Official next-intl API; same idea as `toBrowserPath` for RSC when preferred |
| `resolveAuthCallback(raw, locale)`          | Safe auth callback → `{ intlHref, browserUrl }`                             |
| `stripLocaleFromPath` / `getLocaleFromPath` | Parse request pathnames (middleware, active-tab matching)                   |

## Auth callback flow

1. Middleware redirects to login with `callbackUrl=/dashboard` (unprefixed).
2. Credentials login: `router.replace(intlHref)` after success.
3. Google / full-page NextAuth: `signIn(..., { callbackUrl: browserUrl })`.

## Quick checklist

- [ ] In-app nav → `ROUTES` or unprefixed string + `@/i18n/navigation`
- [ ] Server `redirect` → `redirect({ href: ROUTES.X, locale })`
- [ ] NextAuth / external absolute path → `toBrowserPath(ROUTES.X, locale)`
- [ ] Reading `callbackUrl` from query → `resolveAuthCallback(...)`
- [ ] No `next/link` / `next/navigation` `useRouter` for app pages (ESLint)
