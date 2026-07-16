import { createQuizDraftIdRoute } from './draft-id-route';

export const dynamic = 'force-dynamic';

export const GET = createQuizDraftIdRoute();
export const PATCH = createQuizDraftIdRoute({ method: 'PATCH' });
export const DELETE = createQuizDraftIdRoute({ method: 'DELETE' });
