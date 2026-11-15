'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { readResumeBannerClaim, type ResumeBannerClaim } from '@/features/quiz/lib/guest-claims';
import type { ResumeBannerPage, ResumeBannerTone } from './ResumeBannerStrip';

// The strip (buttons, sign-in, analytics) loads only once a claim exists, so a page with
// no claim pays for this small gate and nothing else (RIN-1714).
const ResumeBannerStrip = dynamic(() => import('./ResumeBannerStrip'), { ssr: false });

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
 * server and on the first client render, then reads `localStorage` in an effect, so the
 * page's HTML is byte-identical with or without a claim. No cookie, header or fetch.
 */
export function GuestResumeBanner({
  page,
  tone = 'app',
  placement = 'flow',
  widthClass = 'max-w-[1340px]',
  mainId,
  enabled = true,
}: GuestResumeBannerProps) {
  const [claim, setClaim] = useState<ResumeBannerClaim | null>(null);

  useEffect(() => {
    setClaim(enabled ? readResumeBannerClaim() : null);
  }, [enabled]);

  if (!claim) return null;
  return (
    <ResumeBannerStrip
      claim={claim}
      page={page}
      tone={tone}
      placement={placement}
      widthClass={widthClass}
      onDismiss={() => {
        setClaim(null);
        document.getElementById(mainId)?.focus({ preventScroll: true });
      }}
    />
  );
}
