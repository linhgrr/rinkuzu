import ProfileSettings from '@/features/profile/components/ProfileSettings';
import { isProfileTab, type ProfileTab } from '@/features/profile/lib/profile-tabs';

function ProfileContent({ initialTab }: { initialTab: ProfileTab }) {
  return (
    <div className="min-h-screen bg-surface-page pb-24 md:pb-8">
      <main className="pt-6 md:pt-8 pb-4 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <ProfileSettings initialTab={initialTab} />
        </div>
      </main>
    </div>
  );
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  const initialTab = isProfileTab(tab) ? tab : 'overview';
  return <ProfileContent key={initialTab} initialTab={initialTab} />;
}
