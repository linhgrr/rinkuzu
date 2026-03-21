import { NextResponse } from 'next/server';
import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { AsyncRouteParams } from '@/types/next-route';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: AsyncRouteParams<{ jobId: string }>,
) {
    const { jobId } = await params;
    return proxyAdaptiveRequest(req, `/api/pipeline/jobs/${jobId}`, {
        timeoutMs: 20_000,
    });
}
