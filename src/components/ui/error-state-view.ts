/**
 * ErrorState view model (RIN-751 design spec, sections 2-4): tone, icon, copy keys and CTAs
 * for one described API error. Pure: no React state, no server text.
 */
import {
  CircleAlert,
  Hourglass,
  LogIn,
  RefreshCw,
  SearchX,
  ServerCrash,
  ShieldAlert,
  Sparkles,
  Timer,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { ApiErrorKind, DescribedApiError } from '@/lib/api/error-kind';

export type ErrorStateVariant = 'inline' | 'page';
type ErrorStateTone = 'error' | 'neutral' | 'info';
export type ErrorStateActionKind = 'retry' | 'reload' | 'signIn' | 'upgrade' | 'goHome' | 'back';

export interface ErrorStateView {
  tone: ErrorStateTone;
  Icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
  bodyValues?: Record<string, string | number>;
  primary: ErrorStateActionKind | null;
  secondary: ErrorStateActionKind | null;
  /** Seconds the primary Retry stays disabled (rate limit, duplicate request). */
  countdownSeconds: number | null;
  /** Support reference (`Code: {code}`), page variant only. */
  code: string | null;
}

interface KindRule {
  tone: ErrorStateTone;
  Icon: LucideIcon;
  primary: ErrorStateActionKind | null;
  secondaryInline: ErrorStateActionKind | null;
  secondaryPage: ErrorStateActionKind | null;
}

type RenderedKind = Exclude<ApiErrorKind, 'aborted'>;

const KIND_RULES: Readonly<Record<RenderedKind, KindRule>> = {
  auth_required: {
    tone: 'neutral',
    Icon: LogIn,
    primary: 'signIn',
    secondaryInline: null,
    secondaryPage: 'goHome',
  },
  unlock_required: {
    tone: 'neutral',
    Icon: Sparkles,
    primary: 'upgrade',
    secondaryInline: 'back',
    secondaryPage: 'back',
  },
  forbidden: {
    tone: 'error',
    Icon: ShieldAlert,
    primary: 'goHome',
    secondaryInline: null,
    secondaryPage: 'back',
  },
  not_found: {
    tone: 'neutral',
    Icon: SearchX,
    primary: 'goHome',
    secondaryInline: 'back',
    secondaryPage: 'back',
  },
  conflict: {
    tone: 'info',
    Icon: RefreshCw,
    primary: 'reload',
    secondaryInline: null,
    secondaryPage: null,
  },
  rate_limited: {
    tone: 'info',
    Icon: Timer,
    primary: 'retry',
    secondaryInline: null,
    secondaryPage: null,
  },
  validation: {
    tone: 'error',
    Icon: CircleAlert,
    primary: 'retry',
    secondaryInline: null,
    secondaryPage: null,
  },
  unavailable: {
    tone: 'info',
    Icon: Hourglass,
    primary: 'retry',
    secondaryInline: null,
    secondaryPage: 'goHome',
  },
  server: {
    tone: 'error',
    Icon: ServerCrash,
    primary: 'retry',
    secondaryInline: null,
    secondaryPage: 'goHome',
  },
  network: {
    tone: 'info',
    Icon: WifiOff,
    primary: 'retry',
    secondaryInline: null,
    secondaryPage: null,
  },
  unknown: {
    tone: 'error',
    Icon: CircleAlert,
    primary: 'retry',
    secondaryInline: null,
    secondaryPage: 'goHome',
  },
};

/** Code-specific primary CTA (spec section 4); `null` means no primary at all. */
const CODE_PRIMARY: Readonly<Record<string, ErrorStateActionKind | null>> = {
  pipeline_not_completed: 'retry',
  ask_rin_conversation_busy: null,
  request_in_progress: 'retry',
  payment_creation_disabled: null,
  unsupported_media_type: null,
};

const REQUEST_IN_PROGRESS_COOLDOWN_SECONDS = 3;
const CODE_LINE_KINDS: ReadonlySet<ApiErrorKind> = new Set(['server', 'unavailable', 'unknown']);

function needsRetryHandler(action: ErrorStateActionKind | null): boolean {
  return action === 'retry' || action === 'reload';
}

export interface ErrorStateViewInput {
  described: DescribedApiError;
  variant: ErrorStateVariant;
  hasRetry: boolean;
}

/** `null` for aborted requests: render nothing. */
export function resolveErrorStateView({
  described,
  variant,
  hasRetry,
}: ErrorStateViewInput): ErrorStateView | null {
  if (described.kind === 'aborted') return null;
  const rule = KIND_RULES[described.kind];
  const code = described.code;

  let primary = code !== null && code in CODE_PRIMARY ? (CODE_PRIMARY[code] ?? null) : rule.primary;
  let secondary = variant === 'page' ? rule.secondaryPage : rule.secondaryInline;

  // Never a dead button: Retry/Reload only with a handler. A page falls back to Go home.
  if (needsRetryHandler(primary) && !hasRetry) {
    primary = variant === 'page' ? 'goHome' : null;
  }
  if (secondary === primary) secondary = null;

  let countdownSeconds: number | null = null;
  if (primary === 'retry' && described.kind === 'rate_limited') {
    countdownSeconds = described.retryAfterSeconds;
  } else if (primary === 'retry' && code === 'request_in_progress') {
    countdownSeconds = REQUEST_IN_PROGRESS_COOLDOWN_SECONDS;
  }

  return {
    tone: rule.tone,
    Icon: rule.Icon,
    titleKey: `${described.messageKey}Title`,
    bodyKey: described.messageKey,
    ...(described.messageValues ? { bodyValues: described.messageValues } : {}),
    primary,
    secondary,
    countdownSeconds,
    code: variant === 'page' && CODE_LINE_KINDS.has(described.kind) ? code : null,
  };
}
