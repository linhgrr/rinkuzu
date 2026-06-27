import ProfileQuizzes from '@/features/profile/components/ProfileQuizzes';

export default async function MyQuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab === 'folders' ? 'folders' : 'quizzes';
  return <ProfileQuizzes tab={tab} />;
}
