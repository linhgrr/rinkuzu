import { Link } from '@/i18n/navigation';
import { HiOutlineChevronRight } from 'react-icons/hi';

type SectionHeadingProps = {
  title: string;
  subtitle: string;
  href?: string;
  viewAllLabel?: string;
};

/**
 * Section header from the Figma home design system: title row with an optional
 * "view all" link, and a subtitle below.
 */
function SectionHeading({ title, subtitle, href, viewAllLabel = 'View all' }: SectionHeadingProps) {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex w-full items-center gap-1">
        <h2 className="min-w-0 flex-1 font-home text-lg font-semibold leading-[1.4] text-ink">
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-2 font-home text-base font-semibold leading-[1.4] text-ink-strong hover:text-accent"
          >
            <span>{viewAllLabel}</span>
            <HiOutlineChevronRight className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <p className="font-home text-base font-normal leading-[1.4] text-ink">{subtitle}</p>
    </div>
  );
}
SectionHeading.displayName = 'SectionHeading';

export { SectionHeading };
