import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        const response = await fetch(`${apiUrl}/api/history/subjects`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            next: { revalidate: 60, tags: ['adaptive-learning-subjects'] } // Short cache
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch subjects: ${response.statusText}`);
        }

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
