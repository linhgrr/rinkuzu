import type { ActivationEmailWeekViewModel } from '@/features/admin/stats/types/admin-stats-view-model';

type TranslateFn = (key: string) => string;

const DASH = '–';

function shareCell(count: number, sent: number): string {
  return `${count} (${sent === 0 ? DASH : `${Math.round((count / sent) * 100)}%`})`;
}

function EmailRow({ week, t }: { week: ActivationEmailWeekViewModel; t: TranslateFn }) {
  return (
    <tr className="border-t border-line">
      <th
        scope="row"
        className="sticky left-0 bg-white px-3 py-2 text-left font-medium whitespace-nowrap text-neutral-900"
      >
        <span className="block">{week.isoWeek}</span>
        <span className="block text-xs font-normal text-neutral-500">{week.monday}</span>
        {week.inProgress ? (
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {t('activationFunnelInProgress')}
          </span>
        ) : null}
      </th>
      <td className="px-3 py-2 text-right tabular-nums">{week.sent}</td>
      <td className="px-3 py-2 text-right text-neutral-500 tabular-nums">{week.sentDay1}</td>
      <td className="px-3 py-2 text-right text-neutral-500 tabular-nums">{week.sentBackfill}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
        {shareCell(week.clicked, week.sent)}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
        {shareCell(week.activatedWithin7d, week.sent)}
      </td>
    </tr>
  );
}

const COLUMNS = [
  'activationEmailSent',
  'activationEmailSentDay1',
  'activationEmailSentBackfill',
  'activationEmailClicked',
  'activationEmailActivated',
] as const;

/** Activation nudge sends by send week (RIN-1001): aggregate counts only. */
export function ActivationEmailTable({
  weeks,
  t,
}: {
  weeks: ActivationEmailWeekViewModel[];
  t: TranslateFn;
}) {
  const anySent = weeks.some((week) => week.sent > 0);
  return (
    <section className="mt-6" aria-labelledby="activation-email-title">
      <h3 id="activation-email-title" className="mb-2 text-sm font-semibold text-neutral-900">
        {t('activationEmailTitle')}
      </h3>
      {anySent ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table
              aria-label={t('activationEmailTableLabel')}
              className="w-full min-w-[560px] text-sm text-neutral-700"
            >
              <thead className="bg-neutral-50 text-xs text-neutral-600">
                <tr>
                  <th scope="col" className="sticky left-0 bg-neutral-50 px-3 py-2 text-left">
                    {t('activationEmailWeek')}
                  </th>
                  {COLUMNS.map((key) => (
                    <th key={key} scope="col" className="px-3 py-2 text-right">
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <EmailRow key={week.isoWeek} week={week} t={t} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-neutral-500">{t('activationEmailCaption')}</p>
        </>
      ) : (
        <p className="rounded-lg border border-line bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
          {t('activationEmailEmpty')}
        </p>
      )}
    </section>
  );
}
