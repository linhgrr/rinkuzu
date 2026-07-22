import { ROUTES } from '@/shared/constants/routes';
import type { ProductScope } from '@/lib/routing/pathname';

/**
 * Shared app navigation paths (locale-unprefixed).
 * Desktop/mobile shells own their own icons/layout; hrefs + scopes live here.
 */

export const AUTH_REQUIRED_PATH_PREFIXES = [
  ROUTES.DASHBOARD,
  '/adaptive/upload',
  '/adaptive/processing',
  '/adaptive/exercise',
  '/adaptive/subject',
  '/adaptive/result',
  ROUTES.CREATE_QUIZ,
  '/profile',
  '/review',
  ROUTES.SUBSCRIPTION,
  '/history',
  '/bookmarks',
  '/my-quizzes',
  '/draft',
  '/edit',
] as const;

type NavItemDef = {
  href: string;
  labelKey: string;
  matchPrefix?: string;
};

export type DesktopNavGroupDef = {
  id: string;
  labelKey: string;
  href?: string;
  matchPrefix?: string;
  requiredRole?: 'admin';
  items?: NavItemDef[];
};

/** Desktop sidebar primary groups (AppChrome). */
export const DESKTOP_PRIMARY_NAV: DesktopNavGroupDef[] = [
  { id: 'home', labelKey: 'home', href: ROUTES.DASHBOARD },
  {
    id: 'quiz',
    labelKey: 'groupQuizBuilder',
    matchPrefix: '/create',
    items: [
      { href: ROUTES.CREATE_QUIZ, labelKey: 'createQuiz' },
      { href: '/my-quizzes', labelKey: 'myQuizzes' },
      { href: '/review', labelKey: 'review' },
      { href: '/history', labelKey: 'history', matchPrefix: '/history' },
      { href: '/bookmarks', labelKey: 'bookmarks' },
    ],
  },
  {
    id: 'adaptive',
    labelKey: 'groupAdaptiveLearning',
    href: '/adaptive',
    matchPrefix: '/adaptive',
    items: [
      { href: '/adaptive', labelKey: 'adaptiveLibrary' },
      { href: '/adaptive/upload', labelKey: 'adaptiveUpload' },
    ],
  },
  {
    id: 'admin',
    labelKey: 'groupAdmin',
    requiredRole: 'admin',
    items: [
      { href: ROUTES.ADMIN.QUIZZES, labelKey: 'quizManagement' },
      { href: ROUTES.ADMIN.USERS, labelKey: 'userManagement' },
      { href: ROUTES.ADMIN.SUBSCRIPTIONS, labelKey: 'subscriptions' },
      { href: ROUTES.ADMIN.PLANS, labelKey: 'pricingPlans' },
      { href: ROUTES.ADMIN.STATS, labelKey: 'statistics' },
      { href: ROUTES.ADMIN.REPORTS, labelKey: 'quizReports' },
      { href: '/admin/ocr-keys', labelKey: 'ocrKeys' },
    ],
  },
  { id: 'explore', labelKey: 'explore', href: ROUTES.QUIZZES },
];

export const DESKTOP_BOTTOM_NAV: DesktopNavGroupDef[] = [
  {
    id: 'account',
    labelKey: 'settings',
    href: '/profile',
    items: [
      { href: '/profile', labelKey: 'profile' },
      { href: ROUTES.SUBSCRIPTION, labelKey: 'subscription' },
    ],
  },
  { id: 'help', labelKey: 'helpSupport', href: '/contact' },
];

/** Mobile bottom-tab hrefs by product scope (icons stay in BottomNav). */
type MobileTabId =
  | 'home'
  | 'explore'
  | 'review'
  | 'create'
  | 'profile'
  | 'adaptiveLibrary'
  | 'adaptiveUpload'
  | 'adaptiveProgress';

export type MobileTabDef = {
  id: MobileTabId;
  href: string;
  labelKey: string;
  matchPrefix?: string;
  isCenter?: boolean;
};

const mobileHome: MobileTabDef = {
  id: 'home',
  href: ROUTES.DASHBOARD,
  labelKey: 'tabHome',
};
const mobileExplore: MobileTabDef = {
  id: 'explore',
  href: ROUTES.QUIZZES,
  labelKey: 'tabQuizzes',
};
const mobileReview: MobileTabDef = {
  id: 'review',
  href: '/review',
  labelKey: 'review',
};
const mobileCreate: MobileTabDef = {
  id: 'create',
  href: ROUTES.CREATE_QUIZ,
  labelKey: 'createQuizShort',
  matchPrefix: '/create',
  isCenter: true,
};
const mobileProfile: MobileTabDef = {
  id: 'profile',
  href: '/profile',
  labelKey: 'profile',
};
const mobileAdaptiveLibrary: MobileTabDef = {
  id: 'adaptiveLibrary',
  href: '/adaptive',
  labelKey: 'tabLibrary',
};
const mobileAdaptiveUpload: MobileTabDef = {
  id: 'adaptiveUpload',
  href: '/adaptive/upload',
  labelKey: 'tabUpload',
  isCenter: true,
};
const mobileAdaptiveProgress: MobileTabDef = {
  id: 'adaptiveProgress',
  href: ROUTES.DASHBOARD,
  labelKey: 'tabProgress',
};

export const MOBILE_TABS_BY_SCOPE: Record<ProductScope, MobileTabDef[]> = {
  adaptive: [
    mobileHome,
    mobileAdaptiveLibrary,
    mobileAdaptiveUpload,
    mobileAdaptiveProgress,
    mobileProfile,
  ],
  quiz: [mobileHome, mobileReview, mobileCreate, mobileExplore, mobileProfile],
  hub: [mobileHome, mobileReview, mobileCreate, mobileExplore, mobileProfile],
};
