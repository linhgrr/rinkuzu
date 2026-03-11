import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: { path: string[] } },
) {
    return proxyAdaptiveRequest(req, `/api/history/${params.path.join('/')}`);
}

export async function DELETE(
    req: Request,
    { params }: { params: { path: string[] } },
) {
    return proxyAdaptiveRequest(req, `/api/history/${params.path.join('/')}`, {
        method: 'DELETE',
    });
}
