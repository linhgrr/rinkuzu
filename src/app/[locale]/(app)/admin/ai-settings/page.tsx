import { AiSettingsClient } from '@/features/admin/ai-settings/components/AiSettingsClient';

type AiSettingsPageProps = {
  searchParams: Promise<{
    tab?: string | string[];
    provider?: string | string[];
  }>;
};

export default async function AdminAiSettingsPage({ searchParams }: AiSettingsPageProps) {
  const params = await searchParams;
  const tab = params.tab === 'routing' ? 'routing' : 'provider';
  const provider = typeof params.provider === 'string' ? params.provider : null;

  return <AiSettingsClient initialTab={tab} initialProviderId={provider} />;
}
