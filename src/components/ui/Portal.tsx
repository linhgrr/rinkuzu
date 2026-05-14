'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

function subscribeToClientMount() {
  return () => {};
}

export function Portal({ children }: PortalProps) {
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false,
  );

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}
