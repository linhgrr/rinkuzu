import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        const response = await fetch(`${apiUrl}/api/history/subjects`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId
            },
            cache: 'no-store'
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
