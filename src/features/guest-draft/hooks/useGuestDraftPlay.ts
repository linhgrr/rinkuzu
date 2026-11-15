'use client';

import { useEffect, useState } from 'react';
import {
  fetchGuestDraftPlay,
  fetchGuestDraftProgress,
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

type PlayQuestion = QuizPlayViewModel['questions'][number];

interface GuestDraftPlayReady {
  status: 'ready';
  /** The questions the player opened on; never replaced, so the round never restarts. */
  quiz: QuizPlayViewModel;
  submitAttempt: QuizAttemptSubmitter;
  /** Questions stored after the opening ones, appended to the running round (RIN-1620). */
  moreQuestions: PlayQuestion[];
  /** True while the rest of the draft may still come: the counter reads "5+". */
  pending: boolean;
  /** The round opened on a first batch: the notice keeps the pending line's height. */
  openedPending: boolean;
  token: string;
}

type GuestDraftPlayLoad =
  | { status: 'loading' }
  | GuestDraftPlayReady
  | { status: 'expired' }
  | { status: 'error'; error: unknown };

const NO_TOKEN = Symbol('no guest draft token');

/** Same cadence as the upload page's progress polling. */
const GUEST_DRAFT_REST_POLL_MS = 2_000;
/** About ten minutes: after that the rest is treated as not coming, silently (spec state 4). */
const GUEST_DRAFT_REST_MAX_POLLS = 300;

interface RestCheck {
  questions: PlayQuestion[] | null;
  complete: boolean;
}

/**
 * One look at the rest of a first-batch draft (RIN-1620): the status first, and the
 * questions only when more are stored or the draft is final. Null: nothing new yet.
 */
async function checkRest(token: string, loaded: number): Promise<RestCheck | null> {
  const progress = await fetchGuestDraftProgress(token);
  if (progress.status === 'failed') return { questions: null, complete: true };
  const complete = progress.status === 'ready' && progress.complete !== false;
  if (!complete && progress.questionCount <= loaded) return null;
  const play = await fetchGuestDraftPlay(token);
  return { questions: play.quiz.questions, complete: play.complete };
}

function withRest(load: GuestDraftPlayLoad, rest: RestCheck): GuestDraftPlayLoad {
  if (load.status !== 'ready') return load;
  const extra = rest.questions?.slice(load.quiz.questions.length) ?? [];
  return {
    ...load,
    moreQuestions: extra.length > load.moreQuestions.length ? extra : load.moreQuestions,
    pending: !rest.complete,
  };
}

/**
 * The newest guest draft this browser holds (RIN-1448), loaded for the player. The token
 * comes from localStorage only, never the URL; no token or a 404 means the draft is gone.
 * A draft gone because sign-in claimed it opens the quiz the claim made (RIN-1485). A draft
 * with only its first batch keeps polling until the rest is stored or has failed (RIN-1620).
 */
export function useGuestDraftPlay() {
  const [load, setLoad] = useState<GuestDraftPlayLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [polls, setPolls] = useState(0);
  const router = useRouter();
  const restToken = load.status === 'ready' && load.pending ? load.token : null;
  const loaded =
    load.status === 'ready' ? load.quiz.questions.length + load.moreQuestions.length : 0;

  useEffect(() => {
    let cancelled = false;
    const token = readGuestDraftClaims()[0]?.token;
    const request = token
      ? fetchGuestDraftPlay(token).then((play) => ({ play, token }))
      : Promise.reject(NO_TOKEN);
    request.then(
      ({ play, token: draftToken }) => {
        if (cancelled) return;
        setLoad({
          status: 'ready',
          quiz: play.quiz,
          submitAttempt: (input) => submitGuestDraftAttempt(draftToken, input),
          moreQuestions: [],
          pending: !play.complete,
          openedPending: !play.complete,
          token: draftToken,
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

  useEffect(() => {
    if (!restToken) return;
    let cancelled = false;
    // Every answer schedules the next look; after the last one the rest is not coming.
    const settle = (rest: RestCheck | null) => {
      if (cancelled) return;
      if (rest) setLoad((current) => withRest(current, rest));
      if (polls + 1 < GUEST_DRAFT_REST_MAX_POLLS) setPolls(polls + 1);
      else setLoad((current) => withRest(current, { questions: null, complete: true }));
    };
    const timer = window.setTimeout(() => {
      // A failed check is not a failed draft (spec state 4): try again on the next tick.
      checkRest(restToken, loaded).then(settle, () => settle(null));
    }, GUEST_DRAFT_REST_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [restToken, loaded, polls]);

  return {
    load,
    retry: () => {
      setLoad({ status: 'loading' });
      setAttempt((value) => value + 1);
    },
  };
}
