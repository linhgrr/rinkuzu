import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';
import { GuestDraftPlayClient } from '../../pdf/play/GuestDraftPlayClient';

export const metadata: Metadata = { ...noIndexMetadata, referrer: 'no-referrer' };

/** Guest play on a quiz from pasted text (RIN-1539): the `/try/pdf/play` player, text copy. */
export default function GuestTextDraftPlayPage() {
  return <GuestDraftPlayClient source="text" />;
}
