import { NextResponse } from 'next/server';
import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
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

        return proxyAdaptiveRequest(req, '/api/pipeline/process', {
            method: 'POST',
            body: proxiedForm,
            // Let fetch set multipart boundary automatically.
            contentType: null,
        });
    } catch (error) {
        console.error('Error proxying pipeline process request:', error);
        return NextResponse.json(
            { detail: 'Internal server error while processing upload' },
            { status: 500 },
        );
    }
}
