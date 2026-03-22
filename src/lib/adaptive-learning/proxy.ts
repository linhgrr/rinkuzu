import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isCacheSafeAdaptivePath } from './cache-policy';
import {
    buildAdaptiveServiceHeaders,
    resolveAdaptiveApiUrl,
    resolveAdaptiveProxyTimeoutMs,
} from './config';

type ProxyOptions = {
    method?: string;
    body?: BodyInit | null;
    contentType?: string | null;
    timeoutMs?: number;
    cache?: {
        revalidateSeconds: number;
        tags: string[];
    };
};

function buildTargetUrl(req: Request, targetPath: string): URL {
    const targetUrl = new URL(targetPath, resolveAdaptiveApiUrl());
    const incomingUrl = new URL(req.url);

    incomingUrl.searchParams.forEach((value, key) => {
        targetUrl.searchParams.set(key, value);
    });

    return targetUrl;
}

function shouldAttachBody(method: string): boolean {
    return !['GET', 'HEAD'].includes(method.toUpperCase());
}

function isHtmlResponse(contentType: string | null): boolean {
    return (contentType || '').toLowerCase().includes('text/html');
}

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

        const targetUrl = buildTargetUrl(req, targetPath);

        const headers: Record<string, string> = buildAdaptiveServiceHeaders(userId);

        const method = options?.method || req.method;
        const contentType = options?.contentType === undefined
            ? req.headers.get('content-type')
            : options.contentType;
        if (contentType) {
            headers['Content-Type'] = contentType;
        }

        const controller = new AbortController();
        const timeoutMs = options?.timeoutMs && options.timeoutMs > 0
            ? options.timeoutMs
            : resolveAdaptiveProxyTimeoutMs();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const body = options?.body
            ?? (shouldAttachBody(method) ? await req.text() : undefined);

        const response = await (async () => {
            try {
                const cacheOptions = options?.cache;
                const allowCache =
                    !!cacheOptions
                    && isCacheSafeAdaptivePath(targetPath)
                    && !shouldAttachBody(method)
                    && cacheOptions.revalidateSeconds > 0
                    && cacheOptions.tags.length > 0;

                return await fetch(targetUrl.toString(), {
                    method,
                    headers,
                    body,
                    cache: allowCache ? 'force-cache' : 'no-store',
                    next: allowCache
                        ? {
                            revalidate: cacheOptions.revalidateSeconds,
                            tags: cacheOptions.tags,
                        }
                        : undefined,
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeout);
            }
        })();

        const contentTypeHeader = response.headers.get('content-type');
        if (isHtmlResponse(contentTypeHeader)) {
            return NextResponse.json(
                {
                    detail: 'Adaptive service temporarily unavailable',
                    code: 'upstream_html_error',
                },
                { status: response.ok ? 502 : response.status },
            );
        }

        const responseHeaders = new Headers();
        if (contentTypeHeader) {
            responseHeaders.set('content-type', contentTypeHeader);
        }

        return new NextResponse(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json(
                { detail: 'Adaptive service request timed out' },
                { status: 504 },
            );
        }
        console.error(`Adaptive proxy failed for ${targetPath}:`, error);
        return NextResponse.json(
            { detail: 'Internal server error while proxying adaptive request' },
            { status: 500 },
        );
    }
}
