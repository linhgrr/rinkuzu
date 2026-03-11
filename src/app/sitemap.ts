import type { MetadataRoute } from 'next';
import { serviceFactory } from '@/lib/serviceFactory';
import { defaultLocale, locales } from '@/i18n/config';
import { canonicalFor } from '@/lib/seo';

const STATIC_PUBLIC_ROUTES = ['/', '/explore', '/categories'] as const;

function localeVariants(path: string): { locale: string; path: string }[] {
  return locales.map((locale) => ({ locale, path }));
}

function toEntry(
  locale: string,
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
  lastModified = new Date()
): MetadataRoute.Sitemap[number] {
  return {
    url: canonicalFor(locale, path),
    lastModified,
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of STATIC_PUBLIC_ROUTES) {
    const priority = route === '/' ? 1 : 0.8;
    const changeFrequency = route === '/' ? 'daily' : 'weekly';
    for (const { locale } of localeVariants(route)) {
      entries.push(toEntry(locale, route, changeFrequency, priority));
    }
  }

  const quizService = serviceFactory.getQuizService();
  const categoryService = serviceFactory.getCategoryService();

  try {
    const categoryResult = await categoryService.getCategories();
    if (categoryResult.success && Array.isArray(categoryResult.data)) {
      for (const category of categoryResult.data) {
        if (!category?.slug || category.isActive === false) continue;
        const path = `/category/${category.slug}`;
        for (const { locale } of localeVariants(path)) {
          entries.push(toEntry(locale, path, 'weekly', 0.7, new Date(category.updatedAt || category.createdAt || Date.now())));
        }
      }
    }
  } catch (error) {
    console.error('sitemap category generation failed', error);
  }

  try {
    const quizResult = await quizService.getQuizzes({
      status: 'published',
      isPrivate: false,
      page: 1,
      limit: 5000,
      compact: true,
    });

    for (const quiz of quizResult.quizzes || []) {
      if (!quiz?.slug) continue;
      const path = `/quiz/${quiz.slug}`;
      const quizUpdatedAt = (quiz as any).updatedAt || (quiz as any).createdAt;

      for (const { locale } of localeVariants(path)) {
        entries.push(toEntry(locale, path, 'weekly', 0.7, new Date(quizUpdatedAt || Date.now())));
      }
    }
  } catch (error) {
    console.error('sitemap quiz generation failed', error);
  }

  // Ensure default locale root is first for consistency.
  entries.sort((a, b) => {
    if (a.url === canonicalFor(defaultLocale, '/')) return -1;
    if (b.url === canonicalFor(defaultLocale, '/')) return 1;
    return a.url.localeCompare(b.url);
  });

  return entries;
}
