import { NextResponse } from 'next/server';
import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const response = await proxyAdaptiveRequest(req, '/api/history/subjects');
        if (!response.ok) return response;
        const data = await response.json();
        return NextResponse.json(data.subjects || []);
    } catch (error) {
        console.error('Error fetching subjects via proxy:', error);
        return NextResponse.json(
            { detail: 'Internal server error while fetching subjects' },
            { status: 500 }
        );
    }
}
