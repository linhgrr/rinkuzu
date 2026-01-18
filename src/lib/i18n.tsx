'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const translations = {
  en: {
    'common.loadingDashboard': 'Loading your dashboard...',
    'common.masterAnySubject': 'Master any subject.',
    'common.createAiQuizzes':
      'Create AI-powered quizzes from your study materials. Track progress with Spaced Repetition.',
    'common.getStartedFree': 'Get Started Free',
    'common.logIn': 'Log In',
    'common.exploreAllQuizzes': 'Explore All Quizzes',
    'nav.home': 'Home',
    'nav.review': 'Review',
    'nav.create': 'Create',
    'nav.explore': 'Explore',
    'nav.profile': 'Profile',
    'nav.categories': 'Categories',
    'nav.admin': 'Admin',
    'nav.history': 'History',
    'nav.bookmarks': 'Bookmarks',
    'nav.premium': 'Premium',
    'nav.reviewQueue': 'Review Queue',
    'nav.users': 'Users',
    'nav.adminCategories': 'Categories',
    'nav.createQuiz': 'Create Quiz',
    'nav.myQuizzes': 'My Quizzes',
    'nav.adminPanel': 'Admin Panel',
    'auth.signIn': 'Sign In',
    'auth.getStarted': 'Get Started',
    'auth.signOut': 'Sign Out',
    'role.administrator': 'Administrator',
    'role.user': 'User',
    'language.switcher': 'Language',
  },
  vi: {
    'common.loadingDashboard': 'Đang tải bảng điều khiển của bạn...',
    'common.masterAnySubject': 'Làm chủ mọi môn học.',
    'common.createAiQuizzes':
      'Tạo bài quiz bằng AI từ tài liệu học tập. Theo dõi tiến độ với Lặp lại ngắt quãng.',
    'common.getStartedFree': 'Bắt đầu miễn phí',
    'common.logIn': 'Đăng nhập',
    'common.exploreAllQuizzes': 'Khám phá tất cả bài quiz',
    'nav.home': 'Trang chủ',
    'nav.review': 'Ôn tập',
    'nav.create': 'Tạo',
    'nav.explore': 'Khám phá',
    'nav.profile': 'Hồ sơ',
    'nav.categories': 'Danh mục',
    'nav.admin': 'Quản trị',
    'nav.history': 'Lịch sử',
    'nav.bookmarks': 'Đánh dấu',
    'nav.premium': 'Cao cấp',
    'nav.reviewQueue': 'Hàng đợi duyệt',
    'nav.users': 'Người dùng',
    'nav.adminCategories': 'Danh mục',
    'nav.createQuiz': 'Tạo quiz',
    'nav.myQuizzes': 'Quiz của tôi',
    'nav.adminPanel': 'Bảng quản trị',
    'auth.signIn': 'Đăng nhập',
    'auth.getStarted': 'Bắt đầu',
    'auth.signOut': 'Đăng xuất',
    'role.administrator': 'Quản trị viên',
    'role.user': 'Người dùng',
    'language.switcher': 'Ngôn ngữ',
  },
};

type Locale = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  text: (value: TranslatedText) => string;
}

const DEFAULT_LOCALE: Locale = 'en';
const STORAGE_KEY = 'rinkuzu_locale';

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key: TranslationKey) => key,
  text: (value: TranslatedText) => value.en,
});

const translate = (locale: Locale, key: TranslationKey) => {
  return translations[locale][key] ?? translations.en[key] ?? key;
};

export interface TranslatedText {
  en: string;
  vi: string;
}

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(STORAGE_KEY);
    if (savedLocale === 'en' || savedLocale === 'vi') {
      setLocaleState(savedLocale);
    }
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey) => translate(locale, key),
      text: (value: TranslatedText) => value[locale] ?? value.en,
    }),
    [locale, setLocale]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
