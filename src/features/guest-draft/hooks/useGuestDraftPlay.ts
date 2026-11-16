'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchGuestDraftPlay,
  fetchGuestDraftProgress,
  isGuestDraftGone,
  submitGuestDraftAttempt,
} from '@/features/guest-draft/api/guest-draft-api';
import {
  parseRoundStart,
  rememberGuestDraftRound,
} from '@/features/guest-draft/lib/guest-draft-round';
import {
  readClaimedGuestDraftQuiz,
  readGuestDraftClaims,
} from '@/features/quiz/lib/guest-draft-claims';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';
import type { GuestDraftSource } from '@/shared/constants/guest-draft';
import type { QuizAttemptSubmitter } from '@/features/quiz/hooks/useQuizSubmission';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';

type PlayQuestion = QuizPlayViewModel['questions'][number];

interface GuestDraftPlayReady {
  status: 'ready';
  /** The questions the player opened on; never replaced, so the round never restarts. */
  quiz: QuizPlayViewModel;
  /** Draft index of the round's first question: 0, or where "Keep going" resumes. */
  from: number;
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
  const extra = rest.questions?.slice(load.from + load.quiz.questions.length) ?? [];
  return {
    ...load,
    moreQuestions: extra.length > load.moreQuestions.length ? extra : load.moreQuestions,
    pending: !rest.complete,
  };
}

/**
 * The round the player opens: the whole draft, or from "Keep going"'s start on. A start
 * past the stored questions falls back to the whole draft.
 */
function roundOf(quiz: QuizPlayViewModel, start: number) {
  if (start <= 0 || start >= quiz.questions.length) return { from: 0, quiz };
  const questions = quiz.questions.slice(start);
  return { from: start, quiz: { ...quiz, questions, questionCount: questions.length } };
}

/** Submits the round and remembers which draft questions it covered (RIN-1620). */
async function submitRound(
  token: string,
  input: Parameters<QuizAttemptSubmitter>[0],
  round: { from: number; source: GuestDraftSource; pending: () => boolean },
) {
  const count = input.answers.length;
  const range = round.from > 0 ? { questionRange: { from: round.from, count } } : {};
  const result = await submitGuestDraftAttempt(token, { ...input, ...range });
  rememberGuestDraftRound(result.attemptId, {
    from: round.from,
    count,
    pending: round.pending(),
    source: round.source,
  });
  return result;
}

/**
 * The newest guest draft this browser holds (RIN-1448), loaded for the player. The token
 * comes from localStorage only, never the URL; no token or a 404 means the draft is gone.
 * A draft gone because sign-in claimed it opens the quiz the claim made (RIN-1485). A draft
 * with only its first batch keeps polling until the rest is stored or has failed (RIN-1620).
 */
export function useGuestDraftPlay(source: GuestDraftSource = 'pdf') {
  const [load, setLoad] = useState<GuestDraftPlayLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [polls, setPolls] = useState(0);
  const router = useRouter();
  const pendingRef = useRef(false);
  const restToken = load.status === 'ready' && load.pending ? load.token : null;
  const loaded =
    load.status === 'ready'
      ? load.from + load.quiz.questions.length + load.moreQuestions.length
      : 0;

  useEffect(() => {
    pendingRef.current = load.status === 'ready' && load.pending;
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const token = readGuestDraftClaims()[0]?.token;
    const request = token
      ? fetchGuestDraftPlay(token).then((play) => ({ play, token }))
      : Promise.reject(NO_TOKEN);
    request.then(
      ({ play, token: draftToken }) => {
        if (cancelled) return;
        const { from, quiz } = roundOf(play.quiz, parseRoundStart(window.location.search));
        // Set with the state, not after its commit: a submit before the sync effect below
        // runs would otherwise store a first-batch round as not pending.
        pendingRef.current = !play.complete;
        setLoad({
          status: 'ready',
          quiz,
          from,
          submitAttempt: (input) =>
            submitRound(draftToken, input, { from, source, pending: () => pendingRef.current }),
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
  }, [attempt, router, source]);

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
      checkRest(restToken, loaded).then(settle, (error: unknown) => {
        // A 404 is a draft that is gone: the rest is not coming, so stop polling (RIN-1620).
        settle(isGuestDraftGone(error) ? { questions: null, complete: true } : null);
      });
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
