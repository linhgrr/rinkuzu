import type { UploadWeekViewModel } from '@/features/admin/stats/types/admin-stats-view-model';

type TranslateFn = (key: string) => string;

interface WeekLabelProps {
  week: UploadWeekViewModel;
  firstOfWeek: boolean;
  t: TranslateFn;
}

function WeekCell({ week, firstOfWeek, t }: WeekLabelProps) {
  return (
    <th
      scope="row"
      className="sticky left-0 bg-white px-3 py-2 text-left font-medium whitespace-nowrap text-neutral-900"
    >
      {/* Later rows of a week keep the label for screen readers only. */}
      <span className={firstOfWeek ? 'block' : 'sr-only'}>{week.isoWeek}</span>
      {firstOfWeek ? (
        <span className="block text-xs font-normal text-neutral-500">{week.monday}</span>
      ) : null}
      {firstOfWeek && week.inProgress ? (
        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          {t('activationFunnelInProgress')}
        </span>
      ) : null}
    </th>
  );
}

interface FlatRow {
  week: UploadWeekViewModel;
  key: string;
  cells: [string, string];
  count: number;
}

function flatten(
  weeks: UploadWeekViewModel[],
  pick: (week: UploadWeekViewModel) => { cells: [string, string]; count: number }[],
): FlatRow[] {
  return weeks.flatMap((week) =>
    pick(week).map((row) => ({ week, key: `${week.isoWeek}:${row.cells.join(':')}`, ...row })),
  );
}

function CountTable({
  label,
  columns,
  rows,
  t,
}: {
  label: string;
  columns: [string, string];
  rows: FlatRow[];
  t: TranslateFn;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table aria-label={label} className="w-full min-w-[400px] text-sm text-neutral-700">
        <thead className="bg-neutral-50 text-xs text-neutral-600">
          <tr>
            <th scope="col" className="sticky left-0 bg-neutral-50 px-3 py-2 text-left">
              {t('uploadRejectionsWeek')}
            </th>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-3 py-2 text-left">
                {t(column)}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right">
              {t('uploadRejectionsCount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const firstOfWeek = rows[index - 1]?.week.isoWeek !== row.week.isoWeek;
            return (
              <tr key={row.key} className={firstOfWeek ? 'border-t border-line' : ''}>
                <WeekCell week={row.week} firstOfWeek={firstOfWeek} t={t} />
                <td className="px-3 py-2 text-left whitespace-nowrap text-neutral-900">
                  {row.cells[0]}
                </td>
                <td className="px-3 py-2 text-left whitespace-nowrap">{row.cells[1]}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Refused uploads by file type and reason, and office drafts by page and type
 * (RIN-1785). Counts only: the API stores no file name, content or learner.
 */
export function UploadRejectionsTable({
  weeks,
  t,
}: {
  weeks: UploadWeekViewModel[];
  t: TranslateFn;
}) {
  const rejections = flatten(weeks, (week) =>
    week.rejections.map((row) => ({ cells: [row.ext, row.reason], count: row.count })),
  );
  const drafts = flatten(weeks, (week) =>
    week.officeDrafts.map((row) => ({ cells: [row.surface, row.ext], count: row.count })),
  );
  return (
    <section className="mt-6" aria-labelledby="upload-rejections-title">
      <h3 id="upload-rejections-title" className="mb-2 text-sm font-semibold text-neutral-900">
        {t('uploadRejectionsTitle')}
      </h3>
      {rejections.length === 0 ? (
        <p className="rounded-lg border border-line bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
          {t('uploadRejectionsEmpty')}
        </p>
      ) : (
        <CountTable
          label={t('uploadRejectionsTableLabel')}
          columns={['uploadRejectionsExt', 'uploadRejectionsReason']}
          rows={rejections}
          t={t}
        />
      )}
      <div className="mt-4">
        {drafts.length === 0 ? (
          <p className="rounded-lg border border-line bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
            {t('uploadOfficeDraftsEmpty')}
          </p>
        ) : (
          <CountTable
            label={t('uploadOfficeDraftsTableLabel')}
            columns={['uploadOfficeDraftsSurface', 'uploadRejectionsExt']}
            rows={drafts}
            t={t}
          />
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500">{t('uploadRejectionsCaption')}</p>
    </section>
  );
}
