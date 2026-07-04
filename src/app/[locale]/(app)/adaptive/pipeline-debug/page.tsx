import type { Metadata } from 'next';
import PipelineDebugPage from '@/features/adaptive/components/PipelineDebugPage';
import { buildLocalizedMetadata } from '@/lib/seo';
import type { AsyncRouteParams } from '@/types/next-route';

export async function generateMetadata({
  params,
}: AsyncRouteParams<{ locale: string }>): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/adaptive/pipeline-debug',
    title: 'Pipeline Debug | RinKuzu',
    description: 'Inspect adaptive PDF-to-knowledge-graph pipeline stages.',
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  });
}

export default function AdaptivePipelineDebugRoute() {
  return <PipelineDebugPage />;
}
