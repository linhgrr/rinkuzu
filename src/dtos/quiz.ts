import type { PaginationMeta } from '@/dtos/common';
import { z } from 'zod';
import { questionListSchema } from '@/lib/validation/question';
import {
  objectIdSchema,
  objectIdRouteParamSchema,
  routePathSegmentSchema,
  slugRouteParamSchema,
} from '@/lib/validation/common';
import { guestClaimTokenSchema } from '@/lib/validation/guest-claim-token';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';
import { QUICK_ROUND_SIZE } from '@/shared/constants/quick-round';
import { REPORT_REASONS } from '@/shared/constants/report-reason';
import type { QuizQuestionDisplay, QuizQuestionWithAnswerKey } from '@/shared/types/quiz-question';

const queryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export const quizIdRouteParamsSchema = z.strictObject({ id: objectIdRouteParamSchema });
export const quizSlugRouteParamsSchema = z.strictObject({ slug: slugRouteParamSchema });
export const quizDraftIdRouteParamsSchema = z.strictObject({ id: routePathSegmentSchema });

export const quizListQuerySchema = z.strictObject({
  search: z.string().trim().min(1).max(200).optional(),
  folder: z.union([z.literal(UNFILED_FOLDER_TARGET), objectIdSchema]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  mine: queryBooleanSchema.default(false),
  visibility: z.enum(['public', 'personal']).optional(),
});

export const reportQuizRequestSchema = z.strictObject({
  questionId: objectIdSchema,
  content: z.string().trim().min(1, 'Report content is required').max(2000),
});

/**
 * The quiz-level "Report this quiz" form (RIN-1343): open to anyone. `website`
 * is a honeypot that people never see; a filled one is accepted and dropped.
 */
export const reportQuizPageRequestSchema = z.strictObject({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
  email: z.string().trim().max(254).pipe(z.email()).optional(),
  website: z.string().max(500).optional(),
});

/**
 * Field set shared by the quiz-compose request schemas (create quiz, submit
 * quiz draft). Shared within the DTO layer only — see
 * docs/architecture/three-layer-standard.md.
 */
export const quizComposeBaseFields = {
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(1000).optional(),
  questions: questionListSchema,
  submitToPremium: z.boolean(),
  rightsAttested: z.boolean().optional(),
};

export interface PremiumRightsFields {
  submitToPremium: boolean;
  rightsAttested?: boolean;
}

export function premiumRightsRefinement(
  value: PremiumRightsFields,
  context: z.RefinementCtx,
): void {
  if (value.submitToPremium && value.rightsAttested !== true) {
    context.addIssue({
      code: 'custom',
      path: ['rightsAttested'],
      message: 'You must confirm you have the right to share Premium quiz content',
    });
  }
}

export const createQuizRequestSchema = z
  .strictObject({
    ...quizComposeBaseFields,
    folderId: z.string().trim().min(1).nullable().optional(),
    pdfUrl: z.url().optional(),
  })
  .superRefine(premiumRightsRefinement);

export const updateQuizRequestSchema = z
  .strictObject({
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    folder: z.string().trim().min(1).nullable().optional(),
    questions: questionListSchema.optional(),
    submitToPremium: z.boolean().optional(),
    rightsAttested: z.boolean().optional(),
    pdfUrl: z.url().optional(),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    'No quiz fields provided',
  )
  .superRefine((value, context) => {
    if (value.submitToPremium === true && value.rightsAttested !== true) {
      context.addIssue({
        code: 'custom',
        path: ['rightsAttested'],
        message: 'You must confirm you have the right to share Premium quiz content',
      });
    }
  });

export type CreateQuizRequestDto = z.infer<typeof createQuizRequestSchema>;
export type UpdateQuizRequestDto = z.infer<typeof updateQuizRequestSchema>;
type QuizQuestionInputDto = z.infer<typeof questionListSchema>[number];

export interface QuizListOptionsDto {
  search?: string;
  folder?: string | null;
  page: number;
  limit: number;
  visibility?: 'public' | 'personal';
  userId?: string;
  onlyMine: boolean;
}

/** Public author identity — stable non-PII fields only (no email). */
export interface QuizListAuthorDto {
  id: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface QuizListItemDto {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: QuizListAuthorDto | null;
  folder: string | null;
  visibility: 'public' | 'personal';
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Quiz page metadata (RIN-840). `ownerIndexable` is false when the owner is a
 * test or company account: the page must then carry `noindex`. Server-only:
 * read it in `generateMetadata`, never pass it to a client component.
 */
export interface QuizMetadataDto extends QuizListItemDto {
  ownerIndexable: boolean;
  /** Texts of the first (up to 3) questions, for the generated description (RIN-1241). */
  leadQuestionTexts: string[];
  /** The one language the quiz is written in; its page there is canonical (RIN-1241 D14). */
  contentLocale: 'vi' | 'en';
}

/** A link to another indexable public quiz on a quiz landing (RIN-1241 C12). */
export interface RelatedQuizDto {
  slug: string;
  title: string;
  questionCount: number;
}

export interface RelatedQuizzesQueryDto {
  /** The quiz on the page; never linked to itself. */
  excludeSlug: string;
  /** Only quizzes written in this language (RIN-1241 D14). */
  contentLocale: 'vi' | 'en';
  limit: number;
}

/** An indexable public quiz (RIN-1241 D13), listed once at its content-locale URL. */
export interface PublicQuizSitemapEntryDto {
  slug: string;
  contentLocale: 'vi' | 'en';
  createdAt: string;
  updatedAt?: string;
}

export type QuizQuestionDto = QuizQuestionInputDto & {
  id: string;
};

export type PlayableQuizQuestionDto = QuizQuestionDisplay;

/** Owner/admin view of the personal-data check (RIN-1338); never on public DTOs. */
interface QuizContentFlagsDto {
  personalData: boolean;
  kinds: string[];
}

export interface QuizDetailDto extends QuizListItemDto {
  questions: QuizQuestionDto[];
  pdfUrl?: string;
  tags?: string[];
  contentFlags?: QuizContentFlagsDto;
}

export interface QuizPlayDetailDto extends Omit<
  QuizDetailDto,
  'questions' | 'pdfUrl' | 'contentFlags'
> {
  questions: PlayableQuizQuestionDto[];
  /** Present on a retry-missed session: `questions[i]` is quiz question `questionIndices[i]`. */
  retry?: { ofAttemptId: string; questionIndices: number[] };
}

/** `GET /api/quiz/<slug>/play?retryOf=<attemptId>` (RIN-914). */
export const quizPlayQuerySchema = z.object({
  retryOf: objectIdSchema.optional(),
});

export interface QuizListDto {
  quizzes: QuizListItemDto[];
  pagination: PaginationMeta;
}

export interface DiscussionCommentDto {
  id: string;
  author: {
    id: string;
    name?: string;
    avatar?: string;
  };
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface QuizDiscussionDto {
  id: string;
  questionIndex: number;
  comments: DiscussionCommentDto[];
  createdAt: string;
  updatedAt: string;
}

export type FlashcardQuestionDto = QuizQuestionWithAnswerKey;

export interface FlashcardQuizDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  questions: FlashcardQuestionDto[];
}

export interface QuizAttemptResultDto {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  attemptId: string;
}

export const quizProgressAnswerSchema = z.union([
  z.number().int().min(-1),
  z.array(z.number().int().min(0)).max(20),
]);

export const submitQuizAttemptRequestSchema = z
  .strictObject({
    answers: z.array(quizProgressAnswerSchema),
    idempotencyKey: z.uuid(),
    /**
     * Ignored: signed-in tabs still on a bundle from before RIN-921 send it, and a strict
     * schema would fail their submit. It identifies no one; drop it after 2026-11-20.
     */
    userEmail: z.unknown().optional(),
    retryOfAttemptId: objectIdSchema.optional(),
    guestClaimToken: guestClaimTokenSchema.optional(),
    /** RIN-933: `quick` plays a client-chosen subset of `QUICK_ROUND_SIZE` questions. */
    mode: z.enum(['quick', 'full']).optional(),
    /** Quick round only: `answers[i]` answers quiz question `questionIndices[i]` (play order). */
    questionIndices: z.array(z.number().int().min(0)).optional(),
    /**
     * RIN-1256: where the attempt started (`?entry=`, `?post=` with `entry=blog`,
     * `?topic=` with `entry=hub` since RIN-1417).
     * Any string is accepted; the route keeps only tracked values and drops the rest.
     */
    entry: z.string().optional(),
    post: z.string().optional(),
    topic: z.string().optional(),
  })
  .superRefine((body, ctx) => {
    // The quiz-dependent checks (size threshold, index range) run in the service.
    const indices = body.questionIndices;
    if (body.mode !== 'quick') {
      if (indices !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['questionIndices'],
          message: 'questionIndices is only allowed with mode quick',
        });
      }
      return;
    }
    if (body.retryOfAttemptId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['retryOfAttemptId'],
        message: 'A quick round cannot be a retry',
      });
    }
    if (
      indices === undefined ||
      indices.length !== QUICK_ROUND_SIZE ||
      new Set(indices).size !== indices.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['questionIndices'],
        message: `A quick round needs exactly ${QUICK_ROUND_SIZE} unique question indices`,
      });
    }
  });

export const addDiscussionCommentRequestSchema = z.strictObject({
  questionIndex: z.number().int().min(0),
  content: z.string().trim().min(1, 'Comment content is required').max(2000),
});

function isDenseIndexPermutation(order: readonly number[], size: number): boolean {
  if (order.length !== size) {
    return false;
  }
  const seen = new Set<number>();
  for (const value of order) {
    if (!Number.isInteger(value) || value < 0 || value >= size || seen.has(value)) {
      return false;
    }
    seen.add(value);
  }
  return seen.size === size;
}

export const savedQuizProgressSchema = z
  .strictObject({
    questionOrder: z.array(z.number().int().min(0)),
    optionOrders: z.array(z.array(z.number().int().min(0))),
    userAnswers: z.array(quizProgressAnswerSchema),
    currentQuestionIndex: z.number().int().min(0),
    answeredCount: z.number().int().min(0),
    totalQuestions: z.number().int().min(0),
  })
  .superRefine((progress, ctx) => {
    const { totalQuestions } = progress;

    if (
      progress.questionOrder.length !== totalQuestions ||
      progress.optionOrders.length !== totalQuestions ||
      progress.userAnswers.length !== totalQuestions
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Progress payload length mismatch',
      });
      return;
    }

    if (totalQuestions === 0) {
      if (progress.currentQuestionIndex !== 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid current question index',
          path: ['currentQuestionIndex'],
        });
      }
      if (progress.answeredCount !== 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid answered count',
          path: ['answeredCount'],
        });
      }
      return;
    }

    if (progress.currentQuestionIndex >= totalQuestions) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid current question index',
        path: ['currentQuestionIndex'],
      });
    }

    if (progress.answeredCount > totalQuestions) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid answered count',
        path: ['answeredCount'],
      });
    }

    const derivedAnsweredCount = progress.userAnswers.reduce<number>((count, answer) => {
      if (Array.isArray(answer)) {
        return count + (answer.length > 0 ? 1 : 0);
      }
      return count + (answer >= 0 ? 1 : 0);
    }, 0);
    if (progress.answeredCount !== derivedAnsweredCount) {
      ctx.addIssue({
        code: 'custom',
        message: 'Answered count does not match user answers',
        path: ['answeredCount'],
      });
    }

    if (!isDenseIndexPermutation(progress.questionOrder, totalQuestions)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid question order',
        path: ['questionOrder'],
      });
    }

    progress.optionOrders.forEach((optionOrder, index) => {
      if (optionOrder.length === 0 || !isDenseIndexPermutation(optionOrder, optionOrder.length)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid option order',
          path: ['optionOrders', index],
        });
      }
    });
  });

export type SavedQuizProgressDto = z.infer<typeof savedQuizProgressSchema>;

export interface QuizProgressResponseDto {
  progress: SavedQuizProgressDto | null;
}

export interface SaveQuizProgressResponseDto {
  saved: true;
}

export interface DeleteQuizProgressResponseDto {
  deleted: true;
}

export interface ReportQuizResponseDto {
  reportId: string;
}

/** Guest attempts a new account claims after sign-up (RIN-912 part 3). */
const GUEST_ATTEMPT_CLAIM_MAX_TOKENS = 20;

export const claimGuestAttemptsRequestSchema = z.strictObject({
  tokens: z.array(guestClaimTokenSchema).min(1).max(GUEST_ATTEMPT_CLAIM_MAX_TOKENS),
});

export interface ClaimGuestAttemptsResponseDto {
  claimedAttemptIds: string[];
}
