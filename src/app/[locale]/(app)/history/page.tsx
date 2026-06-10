import ProfileHistory from '@/features/profile/components/ProfileHistory';
import { ProfilePageShell } from '@/features/profile/components/ProfilePageShell';

export default function HistoryPage() {
  return (
    <ProfilePageShell>
      <ProfileHistory />
    </ProfilePageShell>
  );
}
