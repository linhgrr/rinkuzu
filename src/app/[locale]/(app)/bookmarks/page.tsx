import ProfileBookmarks from '@/features/profile/components/ProfileBookmarks';
import { ProfilePageShell } from '@/features/profile/components/ProfilePageShell';

export default function BookmarksPage() {
  return (
    <ProfilePageShell>
      <ProfileBookmarks />
    </ProfilePageShell>
  );
}
