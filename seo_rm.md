# RinKuzu — SEO Audit Report & Roadmap

**Audit Date:** March 26, 2026
**Site:** https://www.rinkuzu.app
**Stack:** Next.js 14 (App Router) + Vercel + next-intl
**Business Type:** SaaS / EdTech — AI Quiz Generator from PDF

---

## 🏆 SEO Health Score: 37 / 100 — Poor

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Technical SEO | 35 | 22% | 7.7 |
| Content Quality | 23 | 23% | 5.3 |
| On-Page SEO | 38 | 20% | 7.6 |
| Schema / Structured Data | 32 | 10% | 3.2 |
| Performance (CWV) | 72 | 10% | 7.2 |
| AI Search Readiness | 25 | 10% | 2.5 |
| Images / Visual | 66 | 5% | 3.3 |
| **Overall** | | | **37 / 100** |

---

## 🔴 Critical Issues

### 1. All SEO Assets Point to Wrong Domain (CRITICAL — 1 fix resolves 8 issues)

> **Status:** Code updated with warning comment. **Manual action required in Vercel dashboard.**
> **Root cause:** `NEXT_PUBLIC_SITE_URL` env var is unset in Vercel. Code falls back to `FALLBACK_SITE_URL = 'https://quizz-ck.vercel.app'` in `src/lib/seo.ts`.

Every canonical, Open Graph, hreflang, sitemap URL, robots.txt directive, and JSON-LD schema points to `quizz-ck.vercel.app` instead of `www.rinkuzu.app`.

| Affected Asset | Current (Wrong) | Correct |
|---|---|---|
| Canonical URL | `quizz-ck.vercel.app/en` | `www.rinkuzu.app/en` |
| OG image | `quizz-ck.vercel.app/icons/...` | `www.rinkuzu.app/icons/...` |
| hreflang `en` | `quizz-ck.vercel.app/en` | `www.rinkuzu.app/en` |
| hreflang `vi` | `quizz-ck.vercel.app/` | `www.rinkuzu.app/` |
| robots.txt Sitemap | `quizz-ck.vercel.app/sitemap.xml` | `www.rinkuzu.app/sitemap.xml` |
| robots.txt Host | `quizz-ck.vercel.app` | `www.rinkuzu.app` |
| Sitemap `<loc>` | 86 URLs on `quizz-ck.vercel.app` | All on `www.rinkuzu.app` |
| All JSON-LD schemas | `quizz-ck.vercel.app` | `www.rinkuzu.app` |

**Fix:** Set `NEXT_PUBLIC_SITE_URL=https://www.rinkuzu.app` in **Vercel → Project → Environment Variables → Production**, then trigger a redeploy. No code changes needed.

---

### 2. E-E-A-T Vacuum (YMYL Risk)

RinKuzu is classified as YMYL (Educational content). Google holds YMYL pages to the highest E-E-A-T standards.

| Signal | Status |
|---|---|
| Named author / expert | ❌ None — only "RinKuzu Team" (anonymous) |
| Author bio pages | ❌ 404 `/about`, `/team`, `/authors` |
| Named team members | ❌ None |
| Third-party testimonials | ❌ Only 1 placeholder ("Nguyễn Văn A") |
| Press coverage | ❌ None |
| Case studies | ❌ None |
| Blog / articles | ❌ Does not exist (8-week content plan documented but never executed) |
| Company credentials | ❌ None — fake address + phone in footer |

**Fake footer data confirmed:**
- Address "Number 1 in Dai Co Viet st" = Hanoi University of Science and Technology's address (not a business office)
- Phone "+1 (234) 567-890" = fictional template number
- Social links: all 4 point to generic `twitter.com`, `facebook.com` — no real brand accounts

**Impact:** LLMs and Google cannot verify the entity. Ranking ceiling is structural.

---

### 3. Thin Content on Key Commercial Pages

| Page | Words | Quality Gate | Gap |
|---|---|---|---|
| Homepage `/en` | ~280 | 500 min | -220 |
| `/pricing` | ~60 | 800 min | -740 |
| `/faq` | ~80 (3 Q&As) | 800 min | -720 |
| `/adaptive-learning` | ~120 | 600 min | -480 |
| Blog / Articles | 0 | 1,500 min | -1,500 |

**Bug:** `/pricing` displays `"Billed $NaN annually"` — billing logic is broken.

---

### 4. Duplicate Schema (Homepage)

Two `SoftwareApplication` schemas on the same page with conflicting names:
- `"RinKuzu"` (from `GuestLanding.tsx` inline)
- `"RinKuzu Adaptive Learning"` (from `structured-data.ts`)

Schema.org expects one instance per type per page.

---

## 🟠 High Priority Issues

### 5. Render-Blocking CSS — 150ms wasted
- 20 KB CSS bundle `938adec...css` is render-blocking
- 47 KB font file preloaded but not subsetted
- Fix: inline critical CSS, defer non-critical, subset fonts to Latin only

### 6. TBT = 270ms (threshold: 200ms)
- JS script evaluation: 328ms total
- 15 synchronous JS chunks loaded without `async`/`defer`
- Estimated mobile Lighthouse score: 65–77/100 (vs desktop 92/100)

### 7. No `/llms.txt`
LLMs (ChatGPT, Claude, Gemini, Perplexity) cannot discover content. This is the single biggest GEO gap.

### 8. No AI Crawler Directives in robots.txt
No explicit `Allow:` rules for GPTBot, Claude-WebBot, Google-Extended. Generic wildcard only.

### 9. `/pricing` — Zero Offer Schema
No structured data despite selling premium plans. No rich results for pricing.

### 10. No Mobile Navigation on Landing Page
Mobile users can only see "Login" and "Get Started" — no way to reach `/pricing`, `/faq`, or any nav link. Entire nav collapses to nothing on mobile.

### 11. Hero CTA Below Fold on Many Mobile Devices
"Start Learning Now" is at ~Y=382px on 390×844 viewport. Tight or below fold on smaller/zoomed screens.

---

## 🟡 Medium Priority Issues

| # | Issue | Fix Effort |
|---|---|---|
| 12 | CSP header missing (XSS risk) | Medium |
| 13 | `Permissions-Policy` header missing | Low |
| 14 | 79% of sitemap URLs have stale `lastmod` (up to 279 days old) | Low |
| 15 | Organization schema has no `sameAs` social profile links | Low |
| 16 | No `HowTo` schema on "How It Works" section | Low |
| 17 | No passage-level anchor IDs — LLMs cannot cite specific paragraphs | Medium |
| 18 | Footer teal accent (`#14b8a6`) clashes with dark-first landing palette | Low |
| 19 | No dark mode — app shell light-only, landing dark-only | Medium |
| 20 | `/en/sitemap.xml` returns 404 | Medium |
| 21 | Zero backlinks / domain authority | High |
| 22 | No Common Crawl / Wayback Machine presence | Medium |
| 23 | LCP = 2.3s — near threshold; Gemini AI processing adds render delay | Medium |

---

## 🟢 Quick Wins (Phase 1 — Already Applied)

| # | Fix | Status | Effort |
|---|---|---|---|
| 1 | Set `NEXT_PUBLIC_SITE_URL` in Vercel → redeploy | ⏳ Pending (manual — set in Vercel dashboard) | 5 min |
| 2 | Remove or replace fake address + phone in footer | ✅ Done (`Footer.tsx`) | 10 min |
| 3 | Fix `$NaN` pricing display | ✅ Done (`pricing2.tsx`) | 15 min |
| 4 | Create `src/app/llms.txt/route.ts` | ✅ Done | 1 hr |
| 5 | Add AI crawler rules to `src/app/robots.ts` | ✅ Done | 15 min |
| 6 | Add `sameAs` social links to Organization schema | ✅ Done (commented, ready to uncomment) | 15 min |
| 7 | Add Offer schema to pricing page | ✅ Done (`availability` + `url` in `structured-data.ts`) | 30 min |
| 8 | Add mobile hamburger to landing nav | ✅ Done (`Navbar.tsx`) | 2 hrs |
| 9 | Reduce hero CTA `pt-[200px]` → `pt-[120px]` for mobile | ✅ Done (`HeroSection.tsx`) | 10 min |
| 10 | Remove dead social link icons | ✅ Done (commented out, placeholder ready) | 10 min |
| 11 | Add CSP + Permissions-Policy headers | ✅ Done (`next.config.js`) | 30 min |
| 12 | Remove duplicate SoftwareApplication schema | ✅ Done (`GuestLanding.tsx`) | 5 min |
| 13 | Add Organization description field | ✅ Done (`structured-data.ts`) | 5 min |

---

## ✅ What's Working Well

- HSTS preload (1-year, includes subdomains) — excellent security
- Next.js Image optimization enabled (`/_next/image`)
- Font preloading with `font-display: swap` — no FOUT
- Zero third-party script overhead
- PWA manifest and service worker well-configured
- `poweredByHeader: false` — no Next.js version leak
- FAQPage, BreadcrumbList, Organization, WebSite schemas structurally correct
- CLS = 0.000 (perfect layout stability)
- LCP = 2.3s (just under 2.5s threshold)
- Clean i18n routing with next-intl (vi/en)
- Custom 404 page with `noindex`
- robots.txt blocks all private routes correctly

---

## 📋 Prioritized Roadmap

### Phase 1: Foundation Fix (Week 1) — Fix Critical Misconfigurations

- [ ] **Set `NEXT_PUBLIC_SITE_URL=https://www.rinkuzu.app`** in Vercel env vars → redeploy
- [ ] Remove or replace fake address + phone in footer (Footer.tsx)
- [ ] Fix `$NaN` pricing display — validate billing API response
- [ ] Remove dead social link icons from footer
- [ ] Create `src/app/llms.txt/route.ts` for LLM content discovery
- [ ] Add GPTBot / Claude-WebBot / Google-Extended Allow rules to `src/app/robots.ts`
- [ ] Remove duplicate `SoftwareApplication` schema from `GuestLanding.tsx`
- [ ] Fix hero CTA mobile fold position (`pt-[200px]` → `pt-[120px]`)
- [ ] Add mobile hamburger menu to landing Navbar

### Phase 2: On-Page Optimization (Week 2)

- [ ] Add `sameAs` social profile links to Organization schema (`src/lib/structured-data.ts`)
- [ ] Add Offer / PriceSpecification schema to `/pricing/page.tsx`
- [ ] Add `HowTo` schema to "How It Works" section in `GuestLanding.tsx`
- [ ] Inline critical CSS, defer main CSS bundle
- [ ] Subset 47 KB font file to Latin characters only
- [ ] Create `/en/sitemap.xml` locale-specific sitemap
- [ ] Add `Permissions-Policy` header to `next.config.js`
- [ ] Add CSP header to `next.config.js` (test carefully with `unsafe-inline` initially)
- [ ] Expand FAQ to 15+ questions
- [ ] Add `lastmod` automation to sitemap generator

### Phase 3: E-E-A-T & Content (Weeks 3–6)

- [ ] Create `/about` page with team info
- [ ] Create author profile pages with Person + Author schema
- [ ] Create first pillar blog post: "How AI Transforms PDF Learning into Adaptive Quizzes"
- [ ] Create second pillar blog post: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide"
- [ ] Add real testimonials with photos and institutional affiliations
- [ ] Create Product Hunt launch page
- [ ] Set up LinkedIn company page and founder profile
- [ ] Add passage-level anchor IDs (`id="..."`) to key content paragraphs

### Phase 4: GEO & Authority (Weeks 7–12)

- [ ] Execute backlink outreach: 10–15 guest posts on edtech/AI blogs
- [ ] Submit to AI tool directories: There's An AI For That, AlternativeTo, SaaS-hub
- [ ] Publish 2 blog posts per month (Medium + Dev.to cross-post)
- [ ] Product Hunt launch
- [ ] Tang referring domains tu 0 len >= 20
- [ ] Add Common Crawl auto-submission to sitemap
- [ ] Apply for Wayback Machine archive inclusion

---

## 📁 Code Files to Modify

| File | Action |
|---|---|
| `src/lib/seo.ts:4` | Update FALLBACK_SITE_URL comment to note env var requirement |
| `src/lib/structured-data.ts` | Add `sameAs` to Organization, fix URL references |
| `src/app/[locale]/_components/guest-landing/Footer.tsx` | Remove/replace fake address, phone, social links |
| `src/app/[locale]/_components/new-landing/Navbar.tsx` | Add mobile hamburger menu |
| `src/app/[locale]/_components/new-landing/HeroSection.tsx` | Fix mobile CTA fold position, add `HowTo` schema |
| `src/app/[locale]/_components/guest-landing/GuestLanding.tsx` | Remove duplicate `SoftwareApplication` inline schema |
| `src/app/[locale]/(marketing)/pricing/page.tsx` | Add Offer schema, expand content |
| `src/app/[locale]/(marketing)/faq/page.tsx` | Expand to 15+ Q&As |
| `src/app/llms.txt/route.ts` | Create — LLM discovery file |
| `src/app/robots.ts` | Add AI crawler Allow rules |
| `src/app/[locale]/sitemap.xml.ts` | Create locale-specific sitemap with correct domain |
| `next.config.js` | Add CSP header, Permissions-Policy header |
| Vercel Environment Variables | Add `NEXT_PUBLIC_SITE_URL=https://www.rinkuzu.app` |

---

## 🎯 Target Metrics (6 months)

| Metric | Current | Target |
|---|---|---|
| SEO Health Score | 37 | 75+ |
| Domain Authority | ~0 | 15+ |
| Referring Domains | 0 | 20+ |
| Indexed Pages | ~71 | 200+ |
| Organic Traffic | Unknown | +500% |
| Blog Posts Published | 0 | 12+ |
| AI Visibility Score | 0 | 20+ |
