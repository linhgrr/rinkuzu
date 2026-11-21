/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UploadWeekViewModel } from '@/features/admin/stats/types/admin-stats-view-model';
import { UploadRejectionsTable } from './UploadRejectionsTable';

// Keys are the assertion surface; copy lives in messages/.
const t = (key: string) => key;

function week(overrides: Partial<UploadWeekViewModel>): UploadWeekViewModel {
  return {
    isoWeek: '2026-W45',
    monday: '2026-11-02',
    rejections: [],
    officeDrafts: [],
    inProgress: false,
    ...overrides,
  };
}

describe('UploadRejectionsTable (RIN-1785)', () => {
  it('shows counts per week by type and reason, with the privacy sentence', () => {
    render(
      <UploadRejectionsTable
        t={t}
        weeks={[
          week({
            inProgress: true,
            rejections: [
              { ext: 'docx', reason: 'wrong_type', count: 5 },
              { ext: 'other', reason: 'other', count: 2 },
            ],
            officeDrafts: [{ surface: 'create_pdf', ext: 'docx', count: 1 }],
          }),
        ]}
      />,
    );

    const rejections = screen.getByRole('table', { name: 'uploadRejectionsTableLabel' });
    const rows = within(rejections).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('2026-W45');
    expect(rows[1]).toHaveTextContent('docxwrong_type5');
    expect(rows[2]).toHaveTextContent('otherother2');
    const drafts = screen.getByRole('table', { name: 'uploadOfficeDraftsTableLabel' });
    expect(drafts).toHaveTextContent('create_pdfdocx1');
    expect(screen.getByText('uploadRejectionsCaption')).toBeInTheDocument();
  });

  it('says so when nothing was refused or drafted', () => {
    render(<UploadRejectionsTable t={t} weeks={[week({})]} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('uploadRejectionsEmpty')).toBeInTheDocument();
    expect(screen.getByText('uploadOfficeDraftsEmpty')).toBeInTheDocument();
    expect(screen.getByText('uploadRejectionsCaption')).toBeInTheDocument();
  });
});
