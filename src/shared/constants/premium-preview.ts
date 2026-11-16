/**
 * RIN-1722: a signed-in learner without access plays this many questions of a Premium quiz
 * before the unlock prompt. Server and client read the same value; kept out of the zod DTOs
 * so client components do not pull the schema library in.
 */
export const PREMIUM_PREVIEW_QUESTION_LIMIT = 5;
