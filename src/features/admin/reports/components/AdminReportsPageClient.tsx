'use client';

import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { AdminReportsPageSkeleton } from '@/features/admin/components/AdminLoadingSkeletons';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import {
  deleteAdminReport,
  fetchAdminReportViewModels,
  hideAdminReportedQuiz,
  updateAdminReportStatus,
} from '@/features/admin/reports/api/admin-reports-api';
import type {
  AdminReportFilterViewModel,
  AdminReportListViewModel,
  AdminReportReasonFilterViewModel,
  AdminReportStatusViewModel,
  AdminReportViewModel,
} from '@/features/admin/reports/types/admin-reports-view-model';
import { ReportedQuestionEditor } from '@/features/admin/reports/components/ReportedQuestionEditor';
import {
  PendingIndexHoldCount,
  ReportCardItem,
  ReportReasonBadges,
  ReportReasonFilterBar,
  StatusBadge,
} from '@/features/admin/reports/components/AdminReportCard';
import { HiOutlineCheck, HiOutlineX } from 'react-icons/hi';
import { useReloadSettled } from '@/features/admin/hooks/useReloadSettled';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

interface AdminReportsState {
  status: 'loading' | 'ready';
  /**
   * Raw load failure; the filters and the list are replaced by ErrorState until a reload
   * succeeds (RIN-1159). Kept while a retry runs: Retry stays pending, no skeleton (RIN-1166).
   */
  loadError: unknown;
  /** Bumped by Retry to rerun the load effect for the same filter. */
  reloadToken: number;
  reports: AdminReportViewModel[];
  pendingIndexHoldCount: number;
  statusFilter: AdminReportFilterViewModel;
  reasonFilter: AdminReportReasonFilterViewModel;
  selectedReport: AdminReportViewModel | null;
  adminNotes: string;
  updating: boolean;
  reportToDelete: AdminReportViewModel | null;
  deleting: boolean;
  /** Quiz-page report whose quiz the admin is about to hide (RIN-1344). */
  reportToHide: AdminReportViewModel | null;
  hiding: boolean;
}

type AdminReportsAction =
  | { type: 'patch'; value: Partial<AdminReportsState> }
  | { type: 'loadSuccess'; value: AdminReportListViewModel };

const REPORT_FILTERS: AdminReportFilterViewModel[] = ['all', 'pending', 'resolved', 'dismissed'];

const initialState: AdminReportsState = {
  status: 'loading',
  loadError: null,
  reloadToken: 0,
  reports: [],
  pendingIndexHoldCount: 0,
  statusFilter: 'all',
  reasonFilter: 'all',
  selectedReport: null,
  adminNotes: '',
  updating: false,
  reportToDelete: null,
  deleting: false,
  reportToHide: null,
  hiding: false,
};

interface ReportFilterBarProps {
  statusFilter: AdminReportFilterViewModel;
  onChange: (status: AdminReportFilterViewModel) => void;
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
      return {
        ...state,
        status: 'ready',
        loadError: null,
        reports: action.value.reports,
        pendingIndexHoldCount: action.value.pendingIndexHoldCount,
      };
    default:
      return state;
  }
}

function ReportFilterBar({ statusFilter, onChange }: ReportFilterBarProps) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
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
    <Modal isOpen={!!report} onClose={onClose} title="Review Report" size="large">
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
              <div className="flex flex-wrap items-center gap-2">
                <strong>Status:</strong> <StatusBadge status={report.status} />
                <ReportReasonBadges report={report} />
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-neutral-50 p-3">
              <p className="mb-1 text-sm font-medium text-neutral-700">Report Content:</p>
              <p className="whitespace-pre-wrap text-sm text-neutral-600">{report.content}</p>
            </div>
          </div>

          <div className="mb-6">
            <ReportedQuestionEditor report={report} />
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

export function AdminReportsPageClient() {
  const describeError = useAdminApiErrorMessage();
  const tAdmin = useTranslations('admin');
  const [state, dispatch] = useReducer(adminReportsReducer, initialState);
  const { waitForReload, settleReload } = useReloadSettled();

  const { statusFilter, reasonFilter } = state;

  useEffect(() => {
    const filters = { status: statusFilter, reason: reasonFilter };
    const controller = new AbortController();
    // Set by the cleanup: a newer filter (or unmount) owns the list now.
    let cancelled = false;

    async function loadReports() {
      try {
        const reports = await fetchAdminReportViewModels(filters, controller.signal);
        if (cancelled) return;
        dispatch({ type: 'loadSuccess', value: reports });
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching reports:', error);
        dispatch({ type: 'patch', value: { status: 'ready', loadError: error } });
      }
      settleReload();
    }

    dispatch({ type: 'patch', value: { status: 'loading' } });
    void loadReports();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [statusFilter, reasonFilter, state.reloadToken, settleReload]);

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
      const reports = await fetchAdminReportViewModels({
        status: statusFilter,
        reason: reasonFilter,
      });
      dispatch({ type: 'loadSuccess', value: reports });
      closeReportModal();
      dispatch({ type: 'patch', value: { updating: false } });
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error(describeError(error));
      dispatch({ type: 'patch', value: { updating: false } });
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      dispatch({ type: 'patch', value: { deleting: true } });
      await deleteAdminReport(reportId);
      const reports = await fetchAdminReportViewModels({
        status: statusFilter,
        reason: reasonFilter,
      });
      dispatch({ type: 'loadSuccess', value: reports });
      if (state.selectedReport?.id === reportId) {
        closeReportModal();
      }
      dispatch({ type: 'patch', value: { deleting: false } });
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error(describeError(error));
      dispatch({ type: 'patch', value: { deleting: false } });
    }
  };

  const confirmHideQuiz = async () => {
    const report = state.reportToHide;
    if (!report) return;
    dispatch({ type: 'patch', value: { hiding: true } });
    try {
      await hideAdminReportedQuiz(report.id, report.adminNotesInput.trim());
      toast.success(`Hid "${report.quizTitle}" and resolved the report`);
      dispatch({ type: 'patch', value: { reportToHide: null, hiding: false } });
      const reports = await fetchAdminReportViewModels({
        status: statusFilter,
        reason: reasonFilter,
      });
      dispatch({ type: 'loadSuccess', value: reports });
    } catch (error) {
      console.error('Error hiding reported quiz:', error);
      toast.error(describeError(error));
      dispatch({ type: 'patch', value: { hiding: false } });
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
        {state.status === 'loading' && !state.loadError ? (
          <AdminReportsPageSkeleton />
        ) : (
          <>
            <AdminPageHeader
              title={tAdmin('quizReports')}
              description={tAdmin('reportsDescription')}
              actions={
                state.loadError ? null : (
                  <PendingIndexHoldCount count={state.pendingIndexHoldCount} />
                )
              }
            />
            {state.loadError ? null : (
              <ReportFilterBar
                statusFilter={state.statusFilter}
                onChange={(status) => dispatch({ type: 'patch', value: { statusFilter: status } })}
              />
            )}
            {state.loadError ? null : (
              <ReportReasonFilterBar
                reasonFilter={state.reasonFilter}
                onChange={(reason) => dispatch({ type: 'patch', value: { reasonFilter: reason } })}
              />
            )}

            <div className="space-y-4">
              {state.loadError ? (
                <ErrorState
                  error={state.loadError}
                  onRetry={() => {
                    dispatch({ type: 'patch', value: { reloadToken: state.reloadToken + 1 } });
                    return waitForReload();
                  }}
                />
              ) : state.reports.length === 0 ? (
                <Card className="p-12">
                  <EmptyState
                    title={tAdmin('noReportsTitle')}
                    description={tAdmin('noReportsFound')}
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
                    onHideQuiz={(value) =>
                      dispatch({ type: 'patch', value: { reportToHide: value } })
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
        title={tAdmin('delete')}
        message={tAdmin('deleteReportConfirm')}
        confirmText={tAdmin('delete')}
        confirmVariant="destructive"
        isLoading={state.deleting}
        onCancel={() => dispatch({ type: 'patch', value: { reportToDelete: null } })}
        onConfirm={confirmDeleteReport}
      />

      <ConfirmModal
        isOpen={!!state.reportToHide}
        title="Hide quiz"
        message={`Hide "${state.reportToHide?.quizTitle ?? ''}" from everyone and resolve this report? The quiz stays in the database and can be shown again from the quiz admin.`}
        confirmText="Hide quiz"
        confirmVariant="destructive"
        isLoading={state.hiding}
        onCancel={() => dispatch({ type: 'patch', value: { reportToHide: null } })}
        onConfirm={confirmHideQuiz}
      />
    </AdminPageShell>
  );
}
