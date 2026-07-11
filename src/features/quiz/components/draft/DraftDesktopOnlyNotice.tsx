'use client';

import { Link } from '@/i18n/navigation';
import { HiOutlineArrowLeft, HiOutlineDesktopComputer } from 'react-icons/hi';
import { ROUTES } from '@/shared/constants/routes';

interface DraftDesktopOnlyNoticeProps {
  title: string;
  description: string;
  backHomeLabel: string;
}

export function DraftDesktopOnlyNotice({
  title,
  description,
  backHomeLabel,
}: DraftDesktopOnlyNoticeProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-6 text-center md:hidden">
      <div>
        <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-green-100">
          <HiOutlineDesktopComputer className="size-10 text-brand-trust" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">{title}</h1>
        <p className="mx-auto mb-6 max-w-xs text-neutral-500">{description}</p>
        <Link
          href={ROUTES.HOME}
          className="inline-flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-trust"
        >
          <HiOutlineArrowLeft className="size-5" />
          {backHomeLabel}
        </Link>
      </div>
    </div>
  );
}
