import type { PipelineStage } from 'mongoose';
import AuditLogModel from '@/models/AuditLog';
import QuizProgressModel from '@/models/QuizProgress';

/**
 * First-session funnel stages of the activation cohort pipeline (RIN-932):
 * sign-ins and in-progress quizzes joined to the per-learner group, and the
 * per-learner flags and per-week sums built from them.
 */

const DAY_MS = 86_400_000;

/** Learners' local timezone, used only for the "later calendar day" test of `returnedWeek1`. */
const LEARNER_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** True when any date in `dates` lies in `[from, to)`. */
export function anyDateIn(dates: string, from: unknown, to: unknown): Record<string, unknown> {
  return {
    $anyElementTrue: [
      {
        $map: {
          input: dates,
          as: 'd',
          in: { $and: [{ $gte: ['$$d', from] }, { $lt: ['$$d', to] }] },
        },
      },
    ],
  };
}

/** The calendar day of `date` in the learners' timezone. */
function learnerDay(date: unknown): Record<string, unknown> {
  return { $dateTrunc: { date, unit: 'day', timezone: LEARNER_TIMEZONE } };
}

/** True when any date in `dates` is before `to` on a later learner calendar day than `after`. */
function anyLaterDayBefore(dates: string, after: unknown, to: unknown): Record<string, unknown> {
  return {
    $anyElementTrue: [
      {
        $map: {
          input: dates,
          as: 'd',
          in: { $and: [{ $gt: [learnerDay('$$d'), learnerDay(after)] }, { $lt: ['$$d', to] }] },
        },
      },
    ],
  };
}

/**
 * `login_success` audit events (`AuditLog {event:1}` or `{createdAt:1}`) in
 * `[from, to + 7 d)`, and quizzes in progress with at least one answer
 * (`QuizProgress {userId:1,updatedAt:-1}`, a type-bracketed range on `userId`).
 */
export function funnelUnionStages(from: Date, to: Date): PipelineStage[] {
  return [
    {
      $unionWith: {
        coll: AuditLogModel.collection.name,
        pipeline: [
          {
            $match: {
              event: 'login_success',
              createdAt: { $gte: from, $lt: new Date(to.getTime() + 7 * DAY_MS) },
            },
          },
          { $project: { _id: 0, uid: '$userId', loginAt: '$createdAt' } },
        ],
      },
    },
    {
      $unionWith: {
        coll: QuizProgressModel.collection.name,
        pipeline: [
          {
            $match: {
              userId: { $type: 'objectId' },
              updatedAt: { $gte: from },
              answeredCount: { $gte: 1 },
            },
          },
          { $project: { _id: 0, uid: '$userId', progressAt: '$updatedAt' } },
        ],
      },
    },
  ];
}

/** Per-learner `$group` fields; `claimedTakenAt` comes from the attempts branch. */
export const FUNNEL_GROUP_FIELDS = {
  claimedTakenAts: { $push: '$claimedTakenAt' },
  loginAts: { $push: '$loginAt' },
  progressAts: { $push: '$progressAt' },
} as const;

/** Per-learner flags; `$takenAts` and `$completedAts` are the activation dates. */
export function funnelFlags(signupAt: string, day7: unknown): Record<string, unknown> {
  return {
    signedIn: anyDateIn('$loginAts', signupAt, day7),
    // An unsubmitted quiz has only `updatedAt`: any update since signup.
    inProgress: {
      $anyElementTrue: [
        { $map: { input: '$progressAts', as: 'd', in: { $gte: ['$$d', signupAt] } } },
      ],
    },
    byClaimedGuest: anyDateIn('$claimedTakenAts', signupAt, day7),
    returnedWeek1: {
      $or: ['$loginAts', '$takenAts', '$completedAts'].map((dates) =>
        anyLaterDayBefore(dates, signupAt, day7),
      ),
    },
  };
}

/** Per-week sums; `$activated` is the learner's activation flag. */
export const FUNNEL_WEEK_ACCUMULATORS = {
  signedIn: { $sum: { $cond: ['$signedIn', 1, 0] } },
  // Every activated learner started a quiz, so activated <= startedQuiz.
  startedQuiz: { $sum: { $cond: [{ $or: ['$activated', '$inProgress'] }, 1, 0] } },
  byClaimedGuest: { $sum: { $cond: ['$byClaimedGuest', 1, 0] } },
  returnedWeek1: { $sum: { $cond: ['$returnedWeek1', 1, 0] } },
} as const;

/** `time` for an attempt a guest made and then claimed into the account (RIN-918); absent otherwise. */
export function claimedAttemptTime(time: string): Record<string, unknown> {
  return { $cond: [{ $eq: [{ $type: '$claimedAt' }, 'date'] }, time, '$$REMOVE'] };
}
