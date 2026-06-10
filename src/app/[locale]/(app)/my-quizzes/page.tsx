import ProfileQuizzes from '@/features/profile/components/ProfileQuizzes';
import { ProfilePageShell } from '@/features/profile/components/ProfilePageShell';

export default function MyQuizzesPage() {
  return (
    <ProfilePageShell>
      <ProfileQuizzes />
    </ProfilePageShell>
  );
}
