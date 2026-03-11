import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: { path: string[] } },
) {
    return proxyAdaptiveRequest(req, `/api/session/${params.path.join('/')}`);
}

export async function POST(
    req: Request,
    { params }: { params: { path: string[] } },
) {
    const rawBody = await req.text();
    return proxyAdaptiveRequest(req, `/api/session/${params.path.join('/')}`, {
        body: rawBody,
        contentType: req.headers.get('content-type') || 'application/json',
    });
}
