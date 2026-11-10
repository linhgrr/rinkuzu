'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { HiOutlineFlag } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';

const loadReportQuizPageDialog = () =>
  import('@/features/quiz/components/ReportQuizPageDialog').then(
    (module) => module.ReportQuizPageDialog,
  );

/**
 * The dialog pulls react-hook-form, zod, Modal and Input, which a public quiz
 * page should not pay for on first load (RIN-1428): it loads on the first click,
 * and hover or focus on the link starts the download early.
 */
const ReportQuizPageDialog = dynamic(loadReportQuizPageDialog, { ssr: false });

interface ReportQuizPageLinkProps {
  slug: string;
  /** Signed-in viewer's address: shown read-only, the API takes it from the session. */
  viewerEmail: string | null;
  /** The owner never reports their own quiz. */
  ownedByViewer: boolean;
}

/**
 * "Báo cáo"/"Report" link on a public quiz page (RIN-1344, spec RIN-1336
 * Part 2b). Anyone, signed out included, can report the whole quiz; the
 * per-question "Báo lỗi" in the player stays separate.
 */
export function ReportQuizPageLink({ slug, viewerEmail, ownedByViewer }: ReportQuizPageLinkProps) {
  const t = useTranslations('report.quizPage');
  const [isOpen, setIsOpen] = useState(false);
  // Mounted from the first open on, so a half-filled form survives closing.
  const [hasOpened, setHasOpened] = useState(false);

  if (ownedByViewer) return null;

  const prefetchDialog = () => {
    void loadReportQuizPageDialog();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setHasOpened(true);
          setIsOpen(true);
        }}
        onPointerEnter={prefetchDialog}
        onFocus={prefetchDialog}
        className="min-h-11 px-2 text-sm font-medium text-neutral-500 hover:text-red-700 focus-visible:text-red-700"
        aria-haspopup="dialog"
      >
        <HiOutlineFlag className="size-4" aria-hidden="true" />
        {t('link')}
      </Button>

      {hasOpened ? (
        <ReportQuizPageDialog
          slug={slug}
          viewerEmail={viewerEmail}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
