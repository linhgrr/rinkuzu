import 'server-only';

import { logger } from '@/lib/logger';
import { renderOutageNotify } from './outage-notify-template';
import type { OutboundCommunicationEmail } from './resend';

/** The API's campaign for the November 2026 outage list (RIN-1650). */
const DEFAULT_OUTAGE_NOTIFY_CAMPAIGN = '2026-11-vercel';
const CAMPAIGN_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;

/** Rows asked per round; the API caps a page at 100. */
const BATCH_SIZE = 50;
const MAX_PAGE = 100;
/** Stop a run once this many sends failed: the provider is likely down. */
const MAX_FAILED_PER_RUN = 50;

export interface OutageNotifyRow {
  id: string;
  email: string;
  locale: string;
}

/** The API's pending list (RIN-1650). Every method throws on a non-2xx answer. */
export interface OutageNotifyList {
  pending(campaign: string, limit: number): Promise<OutageNotifyRow[]>;
  pendingCount(campaign: string): Promise<number>;
  markSent(ids: readonly string[]): Promise<void>;
}

export interface OutageNotifyDeps {
  list: OutageNotifyList;
  /** Locale-unprefixed starter quiz href (may carry `?mode=quick`), or null when none. */
  starterHref(locale: OutageNotifyLocale): Promise<string | null>;
  /** Resolves with the provider id once the provider accepted the email; throws otherwise. */
  send(mail: OutboundCommunicationEmail): Promise<string>;
  from: string;
  siteUrl: string;
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface OutageNotifyOptions {
  campaign: string;
  dryRun: boolean;
  /** Stop starting new sends after this long; a re-run picks up the rest. */
  budgetMs: number;
  /** Gap between two sends, under the provider's per-second limit. */
  sendIntervalMs: number;
}

export interface OutageNotifyResult {
  campaign: string;
  dryRun: boolean;
  sent: number;
  failed: number;
  remaining: number;
}

type OutageNotifyLocale = 'vi' | 'en';

/** The campaign from `OUTAGE_NOTIFY_CAMPAIGN`, else the default; a malformed value falls back too. */
export function outageNotifyCampaign(value: string | undefined): string {
  const campaign = value?.trim();
  return campaign && CAMPAIGN_PATTERN.test(campaign) ? campaign : DEFAULT_OUTAGE_NOTIFY_CAMPAIGN;
}

function rowLocale(locale: string): OutageNotifyLocale {
  return locale === 'en' ? 'en' : 'vi';
}

/** The button's target: the locale's starter quiz (else `/try`), tagged with the campaign UTM. */
function outageNotifyCtaUrl(input: {
  siteUrl: string;
  locale: OutageNotifyLocale;
  starterHref: string | null;
  campaign: string;
}): string {
  const url = new URL(`/${input.locale}${input.starterHref ?? '/try'}`, input.siteUrl);
  url.searchParams.set('utm_source', 'outage_notify');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', input.campaign);
  return url.toString();
}

class OutageNotifyRun {
  private readonly failedIds = new Set<string>();
  private readonly mails = new Map<OutageNotifyLocale, Promise<OutboundMail>>();
  private sent = 0;
  private lastSendAt: number | null = null;

  constructor(
    private readonly deps: OutageNotifyDeps,
    private readonly options: OutageNotifyOptions,
    private readonly deadline: number,
  ) {}

  /** Sends round after round until nothing new is pending, the budget ends or sends keep failing. */
  async run(): Promise<{ sent: number; failed: number }> {
    while (this.deps.now() < this.deadline && this.failedIds.size < MAX_FAILED_PER_RUN) {
      // Failed rows stay pending and come back first, so ask past them.
      const limit = Math.min(MAX_PAGE, BATCH_SIZE + this.failedIds.size);
      const rows = await this.deps.list.pending(this.options.campaign, limit);
      const fresh = rows.filter((row) => !this.failedIds.has(row.id));
      if (fresh.length === 0) break;
      const accepted = await this.sendRound(fresh);
      if (accepted.length > 0) await this.deps.list.markSent(accepted);
      this.sent += accepted.length;
      if (accepted.length === 0) break;
    }
    return { sent: this.sent, failed: this.failedIds.size };
  }

  private async sendRound(rows: readonly OutageNotifyRow[]): Promise<string[]> {
    const accepted: string[] = [];
    for (const row of rows) {
      if (this.deps.now() >= this.deadline) break;
      await this.pace();
      if (await this.sendOne(row)) accepted.push(row.id);
      else this.failedIds.add(row.id);
    }
    return accepted;
  }

  private async pace(): Promise<void> {
    if (this.lastSendAt !== null) {
      const wait = this.lastSendAt + this.options.sendIntervalMs - this.deps.now();
      if (wait > 0) await this.deps.sleep(wait);
    }
    this.lastSendAt = this.deps.now();
  }

  private async sendOne(row: OutageNotifyRow): Promise<boolean> {
    const mail = await this.mailFor(rowLocale(row.locale));
    try {
      await this.deps.send({
        ...mail,
        to: row.email,
        from: this.deps.from,
        // The provider drops a repeat within 24 h, so a re-run after a lost mark-sent sends nothing twice.
        idempotencyKey: `outage-notify:${this.options.campaign}:${row.id}`,
        entityType: 'outage_notify',
        entityId: row.id,
        tags: [{ name: 'campaign', value: this.options.campaign }],
      });
      return true;
    } catch {
      // The provider's message may quote the address: keep it out of the logs.
      return false;
    }
  }

  /** One render per locale per run: the email has no per-recipient content. */
  private mailFor(locale: OutageNotifyLocale): Promise<OutboundMail> {
    let mail = this.mails.get(locale);
    if (!mail) {
      mail = this.deps.starterHref(locale).then((starterHref) =>
        renderOutageNotify({
          locale,
          ctaUrl: outageNotifyCtaUrl({
            siteUrl: this.deps.siteUrl,
            locale,
            starterHref,
            campaign: this.options.campaign,
          }),
        }),
      );
      this.mails.set(locale, mail);
    }
    return mail;
  }
}

type OutboundMail = Pick<OutboundCommunicationEmail, 'subject' | 'html' | 'text'>;

/**
 * Sends the one-off "Rinkuzu is back" email to every pending outage sign-up
 * (RIN-1653, spec RIN-1643 AC 5) and marks the accepted ones sent. A failed
 * send stays pending, so a re-run retries it and skips everyone already sent.
 * Logs and returns counts only, never an address.
 */
export async function runOutageNotifySend(
  deps: OutageNotifyDeps,
  options: OutageNotifyOptions,
): Promise<OutageNotifyResult> {
  const { campaign, dryRun } = options;
  if (dryRun) {
    const remaining = await deps.list.pendingCount(campaign);
    logger.info({ campaign, dryRun, remaining }, 'Outage notify dry run');
    return { campaign, dryRun, sent: 0, failed: 0, remaining };
  }
  const run = new OutageNotifyRun(deps, options, deps.now() + options.budgetMs);
  const { sent, failed } = await run.run();
  const remaining = await deps.list.pendingCount(campaign);
  logger.info({ campaign, dryRun, sent, failed, remaining }, 'Outage notify send finished');
  return { campaign, dryRun, sent, failed, remaining };
}
