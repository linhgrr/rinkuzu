'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, Badge } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminReportsPageSkeleton } from '@/components/admin/AdminLoadingSkeletons';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { ROUTES } from '@/shared/constants/routes';
import {
  deleteAdminReport,
  fetchAdminReportViewModels,
  updateAdminReportStatus,
} from '@/features/admin/reports/api/admin-reports-api';
import type {
  AdminReportFilterViewModel,
  AdminReportStatusViewModel,
  AdminReportViewModel,
} from '@/features/admin/reports/types/admin-reports-view-model';
import {
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineCheck,
  HiOutlineX,
} from 'react-icons/hi';

interface AdminReportsState {
  status: 'loading' | 'ready';
  reports: AdminReportViewModel[];
  statusFilter: AdminReportFilterViewModel;
  selectedReport: AdminReportViewModel | null;
  adminNotes: string;
  updating: boolean;
  reportToDelete: AdminReportViewModel | null;
  deleting: boolean;
}

type AdminReportsAction =
  | { type: 'patch'; value: Partial<AdminReportsState> }
  | { type: 'loadSuccess'; value: AdminReportViewModel[] };

const REPORT_FILTERS: AdminReportFilterViewModel[] = ['all', 'pending', 'resolved', 'dismissed'];

const initialState: AdminReportsState = {
  status: 'loading',
  reports: [],
  statusFilter: 'all',
  selectedReport: null,
  adminNotes: '',
  updating: false,
  reportToDelete: null,
  deleting: false,
};

interface ReportFilterBarProps {
  statusFilter: AdminReportFilterViewModel;
  onChange: (status: AdminReportFilterViewModel) => void;
}

interface ReportCardItemProps {
  report: AdminReportViewModel;
  onReview: (report: AdminReportViewModel) => void;
  onDelete: (report: AdminReportViewModel) => void;
}

interface ReportReviewModalProps {
  report: AdminReportViewModel | null;
  adminNotes: string;
  updating: boolean;
  onClose: () => void;
  onAdminNotesChange: (value: string) => void;
  onResolve: () => void;
  onDismiss: () => void;
}

function adminReportsReducer(
  state: AdminReportsState,
  action: AdminReportsAction,
): AdminReportsState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loadSuccess':
      return { ...state, status: 'ready', reports: action.value };
    default:
      return state;
  }
}

function getStatusBadge(status: AdminReportStatusViewModel) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">{status}</Badge>;
    case 'resolved':
      return <Badge variant="success">{status}</Badge>;
    case 'dismissed':
      return <Badge variant="default">{status}</Badge>;
  }
}

function ReportFilterBar({ statusFilter, onChange }: ReportFilterBarProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {REPORT_FILTERS.map((status) => (
        <Button
          key={status}
          variant={statusFilter === status ? 'gradient' : 'outline'}
          onClick={() => onChange(status)}
          className="min-h-[40px] px-4 capitalize"
        >
          {status === 'all' ? 'All Reports' : status}
        </Button>
      ))}
    </div>
  );
}

function ReportCardItem({ report, onReview, onDelete }: ReportCardItemProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-lg font-semibold text-neutral-900">{report.quizTitle}</h3>
              {getStatusBadge(report.status)}
            </div>

            <div className="mb-3 text-sm text-neutral-600">
              <div className="mb-1 flex items-center gap-4">
                <span>
                  <strong>Reporter:</strong> {report.reporterName} ({report.reporterEmail})
                </span>
                <span>
                  <strong>Date:</strong> {report.createdAtLabel}
                </span>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-neutral-50 p-3">
              <p className="whitespace-pre-wrap text-sm text-neutral-700">{report.content}</p>
            </div>

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

          <div className="ml-4 flex flex-col gap-2">
            <Button
              variant="gradient"
              onClick={() => onReview(report)}
              className="min-h-[36px] px-3"
            >
              <HiOutlineEye className="mr-1 size-4" /> Review
            </Button>

            <Link href={ROUTES.EDIT.QUIZ(report.quizId)}>
              <Button variant="accent" className="min-h-[36px] w-full px-3">
                <HiOutlinePencil className="mr-1 size-4" /> Edit Quiz
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={() => onDelete(report)}
              className="min-h-[36px] border-red-200 px-3 text-red-600 hover:bg-red-50"
            >
              <HiOutlineTrash className="mr-1 size-4" /> Delete
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReportReviewModal({
  report,
  adminNotes,
  updating,
  onClose,
  onAdminNotesChange,
  onResolve,
  onDismiss,
}: ReportReviewModalProps) {
  const tAdmin = useTranslations('admin');
  return (
    <Modal isOpen={!!report} onClose={onClose} title="Review Report">
      {report ? (
        <div>
          <div className="mb-6">
            <h3 className="mb-2 text-lg font-semibold">{report.quizTitle}</h3>
            <div className="mb-3 text-sm text-neutral-600">
              <div>
                <strong>Reporter:</strong> {report.reporterName} ({report.reporterEmail})
              </div>
              <div>
                <strong>Date:</strong> {report.createdAtLabel}
              </div>
              <div>
                <strong>Status:</strong> {getStatusBadge(report.status)}
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-neutral-50 p-3">
              <p className="mb-1 text-sm font-medium text-neutral-700">Report Content:</p>
              <p className="whitespace-pre-wrap text-sm text-neutral-600">{report.content}</p>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="adminNotes" className="mb-2 block text-sm font-medium text-neutral-700">
              Admin Notes (Optional)
            </label>
            <Textarea
              id="adminNotes"
              value={adminNotes}
              onChange={(event) => onAdminNotesChange(event.target.value)}
              className="resize-none"
              rows={4}
              maxLength={1000}
              placeholder={tAdmin('internalNotesPlaceholder')}
            />
            <div className="mt-1 text-xs text-neutral-500">{adminNotes.length}/1000</div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="min-h-[40px] flex-1 px-4">
              Cancel
            </Button>

            <Button
              variant="gradient"
              onClick={onResolve}
              disabled={updating}
              className="min-h-[40px] flex-1 bg-green-600 px-4 hover:bg-green-700"
            >
              {updating ? (
                'Updating…'
              ) : (
                <>
                  <HiOutlineCheck className="mr-1 size-4" /> Mark Resolved
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onDismiss}
              disabled={updating}
              className="min-h-[40px] flex-1 px-4"
            >
              {updating ? (
                'Updating…'
              ) : (
                <>
                  <HiOutlineX className="mr-1 size-4" /> Dismiss
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export default function AdminReportsPage() {
  const [state, dispatch] = useReducer(adminReportsReducer, initialState);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReports() {
      try {
        const reports = await fetchAdminReportViewModels(state.statusFilter, controller.signal);
        dispatch({ type: 'loadSuccess', value: reports });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Error fetching reports:', error);
        dispatch({ type: 'patch', value: { status: 'ready' } });
      }
    }

    dispatch({ type: 'patch', value: { status: 'loading' } });
    void loadReports();

    return () => controller.abort();
  }, [state.statusFilter]);

  const openReportModal = (report: AdminReportViewModel) => {
    dispatch({
      type: 'patch',
      value: {
        selectedReport: report,
        adminNotes: report.adminNotesInput,
      },
    });
  };

  const closeReportModal = () => {
    dispatch({ type: 'patch', value: { selectedReport: null, adminNotes: '' } });
  };

  const updateReportStatus = async (status: AdminReportStatusViewModel) => {
    if (!state.selectedReport) return;

    dispatch({ type: 'patch', value: { updating: true } });
    try {
      await updateAdminReportStatus({
        reportId: state.selectedReport.id,
        status,
        adminNotes: state.adminNotes.trim(),
      });
      const reports = await fetchAdminReportViewModels(state.statusFilter);
      dispatch({ type: 'loadSuccess', value: reports });
      closeReportModal();
      dispatch({ type: 'patch', value: { updating: false } });
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update report');
      dispatch({ type: 'patch', value: { updating: false } });
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      dispatch({ type: 'patch', value: { deleting: true } });
      await deleteAdminReport(reportId);
      const reports = await fetchAdminReportViewModels(state.statusFilter);
      dispatch({ type: 'loadSuccess', value: reports });
      if (state.selectedReport?.id === reportId) {
        closeReportModal();
      }
      dispatch({ type: 'patch', value: { deleting: false } });
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete report');
      dispatch({ type: 'patch', value: { deleting: false } });
    }
  };

  const confirmDeleteReport = async () => {
    if (!state.reportToDelete?.id) return;
    await deleteReport(state.reportToDelete.id);
    if (state.selectedReport?.id === state.reportToDelete.id) {
      closeReportModal();
    }
    dispatch({ type: 'patch', value: { reportToDelete: null } });
  };

  return (
    <AdminPageShell contentClassName="bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {state.status === 'loading' ? (
          <AdminReportsPageSkeleton />
        ) : (
          <>
            <AdminPageHeader
              title="Quiz Reports"
              description="Manage and review user reports about quiz content"
            />
            <ReportFilterBar
              statusFilter={state.statusFilter}
              onChange={(status) => dispatch({ type: 'patch', value: { statusFilter: status } })}
            />

            <div className="space-y-4">
              {state.reports.length === 0 ? (
                <Card className="p-12">
                  <EmptyState
                    title="No Reports Found"
                    description={
                      state.statusFilter === 'all'
                        ? 'No reports have been submitted yet.'
                        : `No ${state.statusFilter} reports found.`
                    }
                  />
                </Card>
              ) : (
                state.reports.map((report) => (
                  <ReportCardItem
                    key={report.id}
                    report={report}
                    onReview={openReportModal}
                    onDelete={(value) =>
                      dispatch({ type: 'patch', value: { reportToDelete: value } })
                    }
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <ReportReviewModal
        report={state.selectedReport}
        adminNotes={state.adminNotes}
        updating={state.updating}
        onClose={closeReportModal}
        onAdminNotesChange={(value) => dispatch({ type: 'patch', value: { adminNotes: value } })}
        onResolve={() => void updateReportStatus('resolved')}
        onDismiss={() => void updateReportStatus('dismissed')}
      />

      <ConfirmModal
        isOpen={!!state.reportToDelete}
        title="Delete report?"
        message="Are you sure you want to delete this report? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="destructive"
        isLoading={state.deleting}
        onCancel={() => dispatch({ type: 'patch', value: { reportToDelete: null } })}
        onConfirm={confirmDeleteReport}
      />
    </AdminPageShell>
  );
}
