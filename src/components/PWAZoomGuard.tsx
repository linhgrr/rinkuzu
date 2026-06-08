'use client';

import { useEffect } from 'react';
import { matchesMedia } from '@/hooks/useMediaQuery';

function isStandalonePWA() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    matchesMedia('(display-mode: standalone)') ||
    matchesMedia('(display-mode: fullscreen)') ||
    navigatorWithStandalone.standalone === true
  );
}

export default function PWAZoomGuard() {
  useEffect(() => {
    if (!isStandalonePWA()) return;

    const preventGestureZoom = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };

    const rootElement = document.documentElement;
    const previousRootTouchAction = rootElement.style.touchAction;

    rootElement.style.touchAction = 'manipulation';

    document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
    document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
    document.addEventListener('gestureend', preventGestureZoom, { passive: false });

    return () => {
      rootElement.style.touchAction = previousRootTouchAction;
      document.removeEventListener('gesturestart', preventGestureZoom);
      document.removeEventListener('gesturechange', preventGestureZoom);
      document.removeEventListener('gestureend', preventGestureZoom);
    };
  }, []);

  return null;
}
