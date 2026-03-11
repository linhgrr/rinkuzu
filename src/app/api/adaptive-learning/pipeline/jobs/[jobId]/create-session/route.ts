import { NextResponse } from 'next/server';
import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';

export const dynamic = 'force-dynamic';

export async function POST(
    req: Request,
    { params }: { params: { jobId: string } },
) {
    const { jobId } = params;
    return proxyAdaptiveRequest(req, `/api/pipeline/jobs/${jobId}/create-session`, {
        method: 'POST',
    });
}
