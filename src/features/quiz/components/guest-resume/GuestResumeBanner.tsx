'use client';

import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
import { readResumeBannerClaim, type ResumeBannerClaim } from '@/features/quiz/lib/guest-claims';
import type { ResumeBannerPage, ResumeBannerTone } from './ResumeBannerStrip';

// The strip (buttons, sign-in, analytics) loads only once a claim exists, so a page with
// no claim pays for this small gate and nothing else (RIN-1714).
const ResumeBannerStrip = dynamic(() => import('./ResumeBannerStrip'), { ssr: false });

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/** A string, so React compares snapshots by value; the claim is rebuilt from it. */
function readSnapshot(): string | null {
  const claim = readResumeBannerClaim();
  return claim ? JSON.stringify(claim) : null;
}

function readServerSnapshot(): null {
  return null;
}

export interface GuestResumeBannerProps {
  page: ResumeBannerPage;
  /** `dark` for the landing wrapper, `app` for the theme tokens. */
  tone?: ResumeBannerTone;
  placement?: 'flow' | 'landing';
  /** Max-width of the inner row, matched to the page's first content block. */
  widthClass?: string;
  /** The page's main landmark (`tabIndex={-1}`): focus goes there when the strip is closed. */
  mainId: string;
  /** False hides the strip, e.g. while a session exists (RIN-1710 AC 3). */
  enabled?: boolean;
}

/**
 * "Your result is still here" for a returning guest (RIN-1714). Renders nothing on the
 * server and the hydrating render, then reads `localStorage` (a store snapshot), so the
 * page's HTML is byte-identical with or without a claim. No cookie, header or fetch.
 */
export function GuestResumeBanner({
  page,
  tone = 'app',
  placement = 'flow',
  widthClass = 'max-w-7xl',
  mainId,
  enabled = true,
}: GuestResumeBannerProps) {
  // The server and the hydrating render see `null`; storage is read right after.
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  if (!enabled || dismissed || snapshot === null) return null;
  const claim: ResumeBannerClaim = JSON.parse(snapshot);
  return (
    <ResumeBannerStrip
      claim={claim}
      page={page}
      tone={tone}
      placement={placement}
      widthClass={widthClass}
      onDismiss={() => {
        setDismissed(true);
        document.getElementById(mainId)?.focus({ preventScroll: true });
      }}
    />
  );
}
