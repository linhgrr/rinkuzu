'use client';

import { HiOutlineChevronLeft } from 'react-icons/hi';
import { Link } from '@/i18n/navigation';
import { ErrorState } from '@/components/ui/ErrorState';

interface BackToListLinkProps {
  href: string;
  label: string;
}

/** The way out of a detail page, shown in every state (RIN-1018, RIN-1159). */
export function BackToListLink({ href, label }: BackToListLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <HiOutlineChevronLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

interface DetailLoadErrorProps extends BackToListLinkProps {
  /** Generic page heading: the record's own title is what failed to load. */
  title: string;
  error: unknown;
  /** Localized "could not load X" line; the title comes from the API error layer. */
  message: string;
  onRetry: () => Promise<unknown>;
}

/**
 * A detail page whose record failed to load keeps a Back link and an h1, and offers Retry,
 * instead of a dead-end line of red text (RIN-1159).
 */
export function DetailLoadError({
  href,
  label,
  title,
  error,
  message,
  onRetry,
}: DetailLoadErrorProps) {
  return (
    <div className="space-y-6">
      <BackToListLink href={href} label={label} />
      <h1 className="break-words font-home text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h1>
      <ErrorState error={error} message={message} onRetry={onRetry} />
    </div>
  );
}
