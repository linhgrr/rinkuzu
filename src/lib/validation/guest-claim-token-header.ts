/**
 * Header that carries a guest claim token (RIN-912). Kept apart from the zod schema in
 * `guest-claim-token.ts` so the browser API client does not bundle zod (RIN-1370).
 */
export const GUEST_CLAIM_TOKEN_HEADER = 'x-guest-claim-token';
