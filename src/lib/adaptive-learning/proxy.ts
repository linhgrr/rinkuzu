import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type ProxyOptions = {
    method?: string;
    body?: BodyInit | null;
    contentType?: string;
};

export async function proxyAdaptiveRequest(
    req: Request,
    targetPath: string,
    options?: ProxyOptions,
) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        if (!userId) {
            return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;
        const targetUrl = new URL(targetPath, apiUrl);
        const incomingUrl = new URL(req.url);

        incomingUrl.searchParams.forEach((value, key) => {
            targetUrl.searchParams.set(key, value);
        });

        const headers: Record<string, string> = {
            'x-user-id': userId,
            ...(serviceToken ? { 'x-service-token': serviceToken } : {}),
        };

        const contentType = options?.contentType || req.headers.get('content-type');
        if (contentType) {
            headers['Content-Type'] = contentType;
        }

        const response = await fetch(targetUrl.toString(), {
            method: options?.method || req.method,
            headers,
            body: options?.body,
            cache: 'no-store',
        });

        const responseText = await response.text();
        return new NextResponse(responseText, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
        });
    } catch (error) {
        console.error(`Adaptive proxy failed for ${targetPath}:`, error);
        return NextResponse.json(
            { detail: 'Internal server error while proxying adaptive request' },
            { status: 500 },
        );
    }
}
