'use client';

import { useEffect, useState } from 'react';
import {
  fetchGuestDraftPlay,
  isGuestDraftGone,
  submitGuestDraftAttempt,
} from '@/features/guest-draft/api/guest-draft-api';
import {
  readClaimedGuestDraftQuiz,
  readGuestDraftClaims,
} from '@/features/quiz/lib/guest-draft-claims';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';
import type { QuizAttemptSubmitter } from '@/features/quiz/hooks/useQuizSubmission';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';

type GuestDraftPlayLoad =
  | { status: 'loading' }
  | { status: 'ready'; quiz: QuizPlayViewModel; submitAttempt: QuizAttemptSubmitter }
  | { status: 'expired' }
  | { status: 'error'; error: unknown };

const NO_TOKEN = Symbol('no guest draft token');

/**
 * The newest guest draft this browser holds (RIN-1448), loaded for the player. The token
 * comes from localStorage only, never the URL; no token or a 404 means the draft is gone.
 * A draft gone because sign-in claimed it opens the quiz the claim made (RIN-1485).
 */
export function useGuestDraftPlay() {
  const [load, setLoad] = useState<GuestDraftPlayLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const token = readGuestDraftClaims()[0]?.token;
    const request = token
      ? fetchGuestDraftPlay(token).then((quiz) => ({ quiz, token }))
      : Promise.reject(NO_TOKEN);
    request.then(
      ({ quiz, token: draftToken }) => {
        if (cancelled) return;
        setLoad({
          status: 'ready',
          quiz,
          submitAttempt: (input) => submitGuestDraftAttempt(draftToken, input),
        });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error !== NO_TOKEN && !isGuestDraftGone(error)) {
          setLoad({ status: 'error', error });
          return;
        }
        const claimedSlug = readClaimedGuestDraftQuiz();
        if (claimedSlug) router.replace(ROUTES.QUIZ.VIEW(encodeURIComponent(claimedSlug)));
        else setLoad({ status: 'expired' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  return {
    load,
    retry: () => {
      setLoad({ status: 'loading' });
      setAttempt((value) => value + 1);
    },
  };
}
