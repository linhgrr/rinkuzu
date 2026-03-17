import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { AsyncRouteParams } from '@/types/next-route';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: AsyncRouteParams<{ path: string[] }>,
) {
    const { path } = await params;
    return proxyAdaptiveRequest(req, `/api/history/${path.join('/')}`);
}

export async function DELETE(
    req: Request,
    { params }: AsyncRouteParams<{ path: string[] }>,
) {
    const { path } = await params;
    return proxyAdaptiveRequest(req, `/api/history/${path.join('/')}`, {
        method: 'DELETE',
    });
}
