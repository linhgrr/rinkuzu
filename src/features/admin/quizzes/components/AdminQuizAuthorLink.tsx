'use client';

import { Link } from '@/i18n/navigation';
import { UserAvatar } from '@/components/user/UserAvatar';
import { getUserDisplayName } from '@/components/user/user-identity';
import type { AdminQuizAuthorViewModel } from '@/features/admin/quizzes/types/admin-quizzes-view-model';
import { ROUTES } from '@/shared/constants/routes';

interface AdminQuizAuthorLinkProps {
  author: AdminQuizAuthorViewModel;
}

export function AdminQuizAuthorLink({ author }: AdminQuizAuthorLinkProps) {
  const content = (
    <>
      <UserAvatar user={author} size={24} />
      <span className="truncate">{getUserDisplayName(author)}</span>
    </>
  );

  return (
    <Link
      href={ROUTES.USER.PROFILE(author.id)}
      className="inline-flex min-w-0 max-w-[220px] items-center gap-2 rounded-full transition hover:text-brand-trust"
    >
      {content}
    </Link>
  );
}
