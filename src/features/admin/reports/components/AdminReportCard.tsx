'use client';

import { Link } from '@/i18n/navigation';
import { HiOutlineEye, HiOutlineEyeOff, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card, Badge } from '@/components/ui/Card';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { ROUTES } from '@/shared/constants/routes';
import { REPORT_REASONS, holdsQuizIndex } from '@/shared/constants/report-reason';
import type {
  AdminReportReasonFilterViewModel,
  AdminReportStatusViewModel,
  AdminReportViewModel,
} from '@/features/admin/reports/types/admin-reports-view-model';

const REASON_LABELS: Record<Exclude<AdminReportReasonFilterViewModel, 'all'>, string> = {
  copyright: 'Copyright',
  personal_data: 'Personal data',
  wrong_content: 'Wrong content',
  offensive: 'Offensive content',
};

const REASON_FILTERS: AdminReportReasonFilterViewModel[] = ['all', ...REPORT_REASONS];

export function StatusBadge({ status }: { status: AdminReportStatusViewModel }) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">{status}</Badge>;
    case 'resolved':
      return <Badge variant="success">{status}</Badge>;
    case 'dismissed':
      return <Badge variant="default">{status}</Badge>;
  }
}

/** Reason and source of a quiz-page report (RIN-1344); per-question reports show neither. */
export function ReportReasonBadges({ report }: { report: AdminReportViewModel }) {
  return (
    <>
      {report.reason ? (
        <Badge variant={holdsQuizIndex(report.reason) ? 'danger' : 'purple'}>
          {REASON_LABELS[report.reason]}
        </Badge>
      ) : null}
      {report.source === 'quiz_page' ? <Badge variant="info">Quiz page</Badge> : null}
    </>
  );
}

interface ReportReasonFilterBarProps {
  reasonFilter: AdminReportReasonFilterViewModel;
  onChange: (reason: AdminReportReasonFilterViewModel) => void;
}

export function ReportReasonFilterBar({ reasonFilter, onChange }: ReportReasonFilterBarProps) {
  return (
    <div role="group" aria-label="Filter by reason" className="mb-6 flex flex-wrap gap-2">
      {REASON_FILTERS.map((reason) => (
        <Button
          key={reason}
          variant={reasonFilter === reason ? 'gradient' : 'outline'}
          aria-pressed={reasonFilter === reason}
          onClick={() => onChange(reason)}
          className="min-h-10 px-4"
        >
          {reason === 'all' ? 'All reasons' : REASON_LABELS[reason]}
        </Button>
      ))}
    </div>
  );
}

/** Header count of pending copyright/personal-data reports: they hold quizzes out of search. */
export function PendingIndexHoldCount({ count }: { count: number }) {
  return (
    <p
      className={
        count > 0
          ? 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800'
          : 'rounded-lg border border-line px-3 py-2 text-sm text-ink-muted'
      }
    >
      {count} pending copyright / personal-data
    </p>
  );
}

interface ReportCardItemProps {
  report: AdminReportViewModel;
  onReview: (report: AdminReportViewModel) => void;
  onDelete: (report: AdminReportViewModel) => void;
  onHideQuiz: (report: AdminReportViewModel) => void;
}

export function ReportCardItem({ report, onReview, onDelete, onHideQuiz }: ReportCardItemProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <div className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h3 className="break-words text-lg font-semibold text-neutral-900">
                {report.quizTitle}
              </h3>
              <StatusBadge status={report.status} />
              <ReportReasonBadges report={report} />
              {report.questionSnapshot ? (
                <Badge variant="info">Question {report.questionSnapshot.index + 1}</Badge>
              ) : report.source ? null : (
                <Badge variant="default">Legacy quiz report</Badge>
              )}
            </div>

            <div className="mb-3 text-sm text-neutral-600">
              <div className="mb-1 flex flex-wrap items-center gap-x-4">
                <span className="break-all">
                  <strong>Reporter:</strong> {report.reporterName} ({report.reporterEmail})
                </span>
                <span>
                  <strong>Date:</strong> {report.createdAtLabel}
                </span>
              </div>
            </div>

            {report.content ? (
              <div className="mb-4 rounded-lg bg-neutral-50 p-3">
                <p className="whitespace-pre-wrap break-words text-sm text-neutral-700">
                  {report.content}
                </p>
              </div>
            ) : null}

            {report.questionSnapshot ? (
              <div className="mb-4 border-l-2 border-brand-action pl-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Reported question snapshot
                </p>
                <QuestionContent
                  content={report.questionSnapshot.question}
                  className="line-clamp-2 text-sm text-neutral-800"
                />
              </div>
            ) : null}

            {report.adminNotes ? (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="mb-1 text-sm font-medium text-green-800">Admin Notes:</p>
                <p className="whitespace-pre-wrap text-sm text-green-700">{report.adminNotes}</p>
              </div>
            ) : null}

            {report.resolvedAt && report.resolvedBy ? (
              <div className="text-xs text-neutral-500">
                Resolved by {report.resolvedBy} on {report.resolvedAtLabel}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:ml-4">
            <Button variant="primary" size="sm" onClick={() => onReview(report)}>
              <HiOutlineEye className="mr-1 size-4" /> Review
            </Button>

            {report.source === 'quiz_page' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onHideQuiz(report)}
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                <HiOutlineEyeOff className="mr-1 size-4" /> Hide quiz
              </Button>
            ) : null}

            <Link href={ROUTES.EDIT.QUIZ(report.quizId)}>
              <Button variant="outline" size="sm" className="w-full">
                <HiOutlinePencil className="mr-1 size-4" /> Edit Quiz
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(report)}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <HiOutlineTrash className="mr-1 size-4" /> Delete
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
