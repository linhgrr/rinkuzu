import type { MetadataRoute } from 'next';
import { buildPublicSitemapEntries } from '@/lib/public-sitemap';

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildPublicSitemapEntries('sitemap: quiz generation failed');
}
