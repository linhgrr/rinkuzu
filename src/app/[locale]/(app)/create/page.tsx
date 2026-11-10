import { GuestCreateHubPage } from '@/features/guest-draft/components/GuestCreateHubPage';
import { CreateQuizHubPage } from '@/features/quiz/components/create/CreateQuizHubPage';
import { getCurrentSession } from '@/lib/auth/session';

/**
 * `/create` is public (RIN-1473): a signed-out visitor gets the guest hub that leads to the
 * PDF trial instead of a redirect to login. Everything under `/create` still needs sign-in.
 */
export default async function CreateQuizRoutePage() {
  const session = await getCurrentSession();
  return session?.user ? <CreateQuizHubPage /> : <GuestCreateHubPage />;
}
