import type { MetadataRoute } from 'next';
import { buildPublicSitemapEntries } from '@/lib/public-sitemap';

// Hourly ISR: scheduled blog posts (future `date`) enter the sitemap on their
// day without a deploy (RIN-1329).
export const revalidate = 3600;
// Rendered on request, never at build: the image build has no database (RIN-1704).
export const dynamic = 'force-dynamic';

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildPublicSitemapEntries('sitemap: quiz generation failed');
}
