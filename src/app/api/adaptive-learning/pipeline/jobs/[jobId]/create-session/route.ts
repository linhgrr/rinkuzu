import { NextResponse } from 'next/server';
import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive-learning/cache-policy';
import { AsyncRouteParams } from '@/types/next-route';

export const dynamic = 'force-dynamic';

export async function POST(
    req: Request,
    { params }: AsyncRouteParams<{ jobId: string }>,
) {
    const { jobId } = await params;
    const response = await proxyAdaptiveRequest(req, `/api/pipeline/jobs/${jobId}/create-session`, {
        method: 'POST',
    });

    invalidateAdaptiveServiceCache();
    return response;
}
