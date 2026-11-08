'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { buildQuizShareUrl, quizShareMode } from '@/features/quiz/lib/quiz-share';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { copyToClipboard } from '@/lib/clipboard';
import { withPending } from '@/lib/async/with-pending';

export interface QuizShareTarget {
  quizId: string;
  slug: string;
  title: string;
  /** Questions in the live quiz: decides `mode=quick` in the link. */
  quizQuestionCount: number;
  /** Questions the learner just answered: the N in the share text. */
  answeredCount: number;
}

interface ShareResultButtonProps {
  share: QuizShareTarget;
  isGuest: boolean;
}

type ShareOutcome = 'native' | 'copy' | 'cancelled' | 'copy_failed';

function isAbortError(error: unknown): boolean {
  // A DOMException is not an `Error` instance in every runtime, so read the name.
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

/** Native share sheet when the browser has one, else copy the link (RIN-1179). */
async function shareOrCopy(data: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareOutcome> {
  const canNativeShare =
    typeof navigator.share === 'function' && navigator.canShare?.(data) !== false;
  if (canNativeShare) {
    try {
      await navigator.share(data);
      return 'native';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }
  return (await copyToClipboard(data.url)) ? 'copy' : 'copy_failed';
}

/**
 * "Send to a classmate" on a public quiz result (RIN-1179). The link and text carry
 * no score, attempt id or learner name; the event carries only quizId, method,
 * mode (of the shared link) and isGuest.
 */
export function ShareResultButton({ share, isGuest }: ShareResultButtonProps) {
  const t = useTranslations('quiz.resultActions');
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  const onShare = async () => {
    const url = buildQuizShareUrl({
      slug: share.slug,
      locale,
      questionCount: share.quizQuestionCount,
    });
    const text = t('shareText', { count: share.answeredCount, title: share.title });
    const outcome = await withPending(setPending, () =>
      shareOrCopy({ title: share.title, text, url }),
    );
    if (outcome === 'copy') toast.success(t('shareCopied'));
    if (outcome === 'copy_failed') toast.error(t('shareCopyFailed'));
    if (outcome === 'native' || outcome === 'copy') {
      captureAnalyticsEvent('quiz_result_shared', {
        quizId: share.quizId,
        method: outcome,
        mode: quizShareMode(share.quizQuestionCount),
        isGuest,
      });
    }
  };

  return (
    <Button
      variant="secondary"
      className="w-full min-h-11 gap-2"
      disabled={pending}
      aria-busy={pending}
      onClick={() => void onShare()}
    >
      <Share2 aria-hidden="true" className="size-4 shrink-0" />
      {t('share')}
    </Button>
  );
}
