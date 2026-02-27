'use client';

import { DashboardClient } from './index';

interface AuthenticatedHomeProps {
    session: any;
}

export function AuthenticatedHome({ session }: AuthenticatedHomeProps) {
    return <DashboardClient userEmail={session?.user?.email || ''} />;
}
