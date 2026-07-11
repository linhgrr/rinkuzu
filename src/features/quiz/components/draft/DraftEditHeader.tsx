'use client';

import { Link } from '@/i18n/navigation';
import { HiOutlineArrowLeft, HiOutlineQuestionMarkCircle } from 'react-icons/hi';
import { ROUTES } from '@/shared/constants/routes';

interface DraftEditHeaderProps {
  title: string;
  questionsLabel: string;
  backLabel: string;
}

export function DraftEditHeader({ title, questionsLabel, backLabel }: DraftEditHeaderProps) {
  return (
    <header className="mb-8">
      <Link
        href={ROUTES.DASHBOARD}
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <HiOutlineArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-1 flex items-center gap-2 text-neutral-500">
        <HiOutlineQuestionMarkCircle className="size-4" />
        {questionsLabel}
      </p>
    </header>
  );
}
