import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';
import { GuestDraftPlayClient } from './GuestDraftPlayClient';

export const metadata: Metadata = { ...noIndexMetadata, referrer: 'no-referrer' };

/** Guest play on the visitor's own PDF (RIN-1448): the token stays in localStorage. */
export default function GuestDraftPlayPage() {
  return <GuestDraftPlayClient />;
}
