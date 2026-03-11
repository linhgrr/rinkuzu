import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        if (!userId) {
            return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
        }

        const incomingForm = await req.formData();
        const file = incomingForm.get('file');
        if (!(file instanceof File)) {
            return NextResponse.json({ detail: 'Missing PDF file' }, { status: 400 });
        }

        const proxiedForm = new FormData();
        proxiedForm.append('file', file, file.name);

        const subjectId = incomingForm.get('subject_id');
        if (typeof subjectId === 'string' && subjectId.trim()) {
            proxiedForm.append('subject_id', subjectId);
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;

        const response = await fetch(`${apiUrl}/api/pipeline/process`, {
            method: 'POST',
            headers: {
                'x-user-id': userId,
                ...(serviceToken ? { 'x-service-token': serviceToken } : {}),
            },
            body: proxiedForm,
            cache: 'no-store',
        });

        const responseText = await response.text();
        return new NextResponse(responseText, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
        });
    } catch (error) {
        console.error('Error proxying pipeline process request:', error);
        return NextResponse.json(
            { detail: 'Internal server error while processing upload' },
            { status: 500 },
        );
    }
}
