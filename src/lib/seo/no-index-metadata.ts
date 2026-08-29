import type { Metadata } from 'next';

/** Shared robots metadata for authenticated / private app surfaces. */
export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

/** Private surface with stronger bot directives (admin). */
export const noIndexAdminMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

/** Noindex but allow link equity follow (e.g. flashcards). */
export const noIndexAllowFollowMetadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};
