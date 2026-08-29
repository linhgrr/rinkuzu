'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { AskRinPanelProps } from './AskRinPanelContent';

/**
 * The load boundary in front of the assistant panel.
 *
 * The panel is a modal that renders nothing until it is opened, but the chat
 * runtime behind it is about 150 KiB gzipped and was in the first-load bundle
 * of every route that mounts one — the quiz result, both adaptive screens and
 * the bookmarks page, which are four of the five heaviest routes in the app.
 * Everyone paid for it on arrival; almost nobody opens it.
 *
 * Deferring it costs nothing in behaviour. The panel already gated every
 * effect and its entire subtree on `isOpen`, and the modal it sits in renders
 * `null` while closed, so an unmounted panel and a closed one put the same
 * thing on the page. Once opened it stays mounted, so closing still animates
 * out and reopening does not pay the download again.
 *
 * This module is the only public name. The implementation lives next door
 * under a name callers have no reason to reach for, which is what stops the
 * import from quietly becoming eager again.
 */
const AskRinPanelContent = dynamic(
  () => import('./AskRinPanelContent').then((module) => module.AskRinPanelContent),
  { ssr: false },
);

export function AskRinPanel(props: AskRinPanelProps) {
  const [hasOpened, setHasOpened] = useState(props.isOpen);

  // Adjusted during render rather than in an effect: opening must load and
  // show the panel in the same pass, and an effect would leave one frame in
  // which it is open and rendering nothing.
  if (props.isOpen && !hasOpened) setHasOpened(true);

  if (!hasOpened) return null;

  return <AskRinPanelContent {...props} />;
}
