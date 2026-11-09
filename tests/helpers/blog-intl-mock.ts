import { createTranslator } from 'next-intl';
import enBlog from '../../messages/en/blog.json';
import viBlog from '../../messages/vi/blog.json';

/**
 * `next-intl/server` stand-in for blog route tests (RIN-1387): the post page reads
 * its chrome from the real `blog` messages, so tests see the shipped copy.
 * Use as `vi.mock('next-intl/server', () => import('<path>/tests/helpers/blog-intl-mock'))`.
 */
export const blogMessages = { en: enBlog, vi: viBlog } as const;

export async function getTranslations({ locale }: { locale: string; namespace: 'blog' }) {
  return createTranslator({
    locale,
    messages: { blog: locale === 'vi' ? viBlog : enBlog },
    namespace: 'blog',
  });
}
