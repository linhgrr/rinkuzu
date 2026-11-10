import { ROUTES } from '@/shared/constants/routes';
import { BLOG_ENTRY } from '@/shared/constants/starter-quiz';
import { LandingCtaLink } from './home/LandingCtaLink';

export interface TryQuizCardLabels {
  heading: string;
  meta: string;
  button: string;
}

type TryQuizCardPosition = 'blog_inline' | 'blog_end' | 'blog_index';

interface TryQuizCardProps {
  labels: TryQuizCardLabels;
  position: TryQuizCardPosition;
  locale: string;
  /** Slug of the post the card sits in; absent on the /blog index. */
  post?: string | undefined;
  /** The post's `quiz.slug`; `/try` falls back to the starter when it is not playable. */
  quiz?: string | undefined;
  teaser?: string | undefined;
}

/** `/try?entry=blog[&post=<post>][&quiz=<quiz>]`, locale-unprefixed (RIN-1258). */
function blogTryHref({ post, quiz }: { post?: string | undefined; quiz?: string | undefined }) {
  const query = new URLSearchParams({ entry: BLOG_ENTRY });
  if (post) query.set('post', post);
  if (quiz) query.set('quiz', quiz);
  return `${ROUTES.TRY}?${query.toString()}`;
}

/**
 * "Try this quiz" card of the blog (RIN-1258, spec RIN-1242): static markup; the only
 * client JS is the link's `landing_cta_clicked` handler. Full width below `sm`, the
 * article column's width above it.
 */
export function TryQuizCard({ labels, position, locale, post, quiz, teaser }: TryQuizCardProps) {
  return (
    <section
      data-testid="try-quiz-card"
      data-position={position}
      className="rounded-3xl border border-neutral-200 bg-[var(--bg-section)] p-6 sm:p-8"
    >
      <h2 className="text-xl font-semibold leading-snug text-[var(--text-primary)] sm:text-2xl">
        {labels.heading}
      </h2>
      {teaser ? <p className="mt-3 leading-relaxed text-[var(--text-muted)]">{teaser}</p> : null}
      <p className="mt-3 text-sm font-medium text-[var(--text-muted)]">{labels.meta}</p>
      <LandingCtaLink
        href={blogTryHref({ post, quiz })}
        cta="play_first"
        position={position}
        locale={locale}
        {...(post ? { post } : {})}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand-trust px-8 py-3 font-bold text-white transition-colors hover:bg-brand-trust-hover sm:w-auto"
      >
        {labels.button}
      </LandingCtaLink>
    </section>
  );
}
