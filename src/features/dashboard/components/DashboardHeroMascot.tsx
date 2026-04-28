'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const DashboardMascot3D = dynamic(() => import('./DashboardMascot3D'), {
  ssr: false,
  loading: () => <MascotPlaceholder />,
});

function MascotPlaceholder() {
  return (
    <div
      className="h-full w-full rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 animate-pulse"
      aria-hidden="true"
    />
  );
}

export function DashboardHeroMascot() {
  const [shouldLoadMascot, setShouldLoadMascot] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const idleApi = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleApi.requestIdleCallback) {
      idleId = idleApi.requestIdleCallback(() => setShouldLoadMascot(true));
    } else {
      timeoutId = window.setTimeout(() => setShouldLoadMascot(true), 300);
    }

    return () => {
      if (idleId !== null && idleApi.cancelIdleCallback) {
        idleApi.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div className="relative z-10 hidden h-72 w-72 shrink-0 items-center justify-center lg:flex">
      <div className="absolute inset-0 rounded-full bg-green-50/50 blur-3xl" />
      <div className="relative z-20 h-full w-full">
        {shouldLoadMascot ? <DashboardMascot3D /> : <MascotPlaceholder />}
      </div>
    </div>
  );
}
