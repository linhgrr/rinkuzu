import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';
import { GuestDraftPlayClient } from '../../pdf/play/GuestDraftPlayClient';

export const metadata: Metadata = { ...noIndexMetadata, referrer: 'no-referrer' };

/** Guest play on a quiz from photos (RIN-1792): the shared player; copy comes with RIN-1793. */
export default function GuestPhotoDraftPlayPage() {
  return <GuestDraftPlayClient source="image" />;
}
