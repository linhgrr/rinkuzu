'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, Badge } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import {
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineCheck,
  HiOutlineX,
} from '@/components/icons';
import { IReport } from '@/models/Report';

export default function AdminReportsPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { data: _session } = useSession();
  const [reports, setReports] = useState<IReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<IReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<IReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/admin/reports?${params}`);
      const data = await response.json();

      if (data.success) {
        setReports(data.data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const openReportModal = (report: IReport) => {
    setSelectedReport(report);
    setAdminNotes(report.adminNotes || '');
    setShowModal(true);
  };

  const closeReportModal = () => {
    setSelectedReport(null);
    setAdminNotes('');
    setShowModal(false);
  };

  const updateReportStatus = async (status: string) => {
    if (!selectedReport) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/reports/${selectedReport._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          adminNotes: adminNotes.trim(),
        }),
      });

      if (response.ok) {
        fetchReports();
        closeReportModal();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update report');
      }
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Failed to update report');
    } finally {
      setUpdating(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchReports();
        if (selectedReport?._id === reportId) {
          closeReportModal();
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete?._id) return;
    await deleteReport(reportToDelete._id);
    if (selectedReport?._id === reportToDelete._id) {
      closeReportModal();
    }
    setReportToDelete(null);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">{status}</Badge>;
      case 'resolved':
        return <Badge variant="success">{status}</Badge>;
      case 'dismissed':
        return <Badge variant="default">{status}</Badge>;
      default:
        return <Badge variant="success">{status}</Badge>;
    }
  };

  return (
    <AdminPageShell contentClassName="bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <LoadingState text={tCommon('loading')} />
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-neutral-900">{t('quizReports')}</h1>
              <p className="mt-2 text-neutral-600">
                Manage and review user reports about quiz content
              </p>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-2">
              {['all', 'pending', 'resolved', 'dismissed'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'gradient' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                  className="min-h-[40px] px-4 capitalize"
                >
                  {status === 'all' ? 'All Reports' : status}
                </Button>
              ))}
            </div>

            {/* Reports List */}
            <div className="space-y-4">
              {reports.length === 0 ? (
                <Card className="p-12">
                  <EmptyState
                    title="No Reports Found"
                    description={
                      statusFilter === 'all'
                        ? 'No reports have been submitted yet.'
                        : `No ${statusFilter} reports found.`
                    }
                  />
                </Card>
              ) : (
                reports.map((report) => (
                  <Card key={report._id} className="hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-neutral-900">
                              {report.quizTitle}
                            </h3>
                            {getStatusBadge(report.status)}
                          </div>

                          <div className="text-sm text-neutral-600 mb-3">
                            <div className="flex items-center gap-4 mb-1">
                              <span>
                                <strong>Reporter:</strong> {report.reporterName} (
                                {report.reporterEmail})
                              </span>
                              <span>
                                <strong>Date:</strong> {formatDate(report.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="bg-neutral-50 rounded-lg p-3 mb-4">
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                              {report.content}
                            </p>
                          </div>

                          {report.adminNotes && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                              <p className="text-sm font-medium text-green-800 mb-1">
                                Admin Notes:
                              </p>
                              <p className="text-sm text-green-700 whitespace-pre-wrap">
                                {report.adminNotes}
                              </p>
                            </div>
                          )}

                          {report.resolvedAt && report.resolvedBy && (
                            <div className="text-xs text-neutral-500">
                              Resolved by {report.resolvedBy} on {formatDate(report.resolvedAt)}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            variant="gradient"
                            onClick={() => openReportModal(report)}
                            className="min-h-[36px] px-3"
                          >
                            <HiOutlineEye className="w-4 h-4 mr-1" /> Review
                          </Button>

                          <Link href={`/edit/${report.quizId}`}>
                            <Button variant="accent" className="min-h-[36px] w-full px-3">
                              <HiOutlinePencil className="w-4 h-4 mr-1" /> Edit Quiz
                            </Button>
                          </Link>

                          <Button
                            variant="outline"
                            onClick={() => setReportToDelete(report)}
                            className="min-h-[36px] border-red-200 px-3 text-red-600 hover:bg-red-50"
                          >
                            <HiOutlineTrash className="w-4 h-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Report Review Modal */}
      <Modal isOpen={showModal} onClose={closeReportModal} title="Review Report">
        {selectedReport && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">{selectedReport.quizTitle}</h3>
              <div className="text-sm text-neutral-600 mb-3">
                <div>
                  <strong>Reporter:</strong> {selectedReport.reporterName} (
                  {selectedReport.reporterEmail})
                </div>
                <div>
                  <strong>Date:</strong> {formatDate(selectedReport.createdAt)}
                </div>
                <div>
                  <strong>Status:</strong> {getStatusBadge(selectedReport.status)}
                </div>
              </div>

              <div className="bg-neutral-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-neutral-700 mb-1">Report Content:</p>
                <p className="text-sm text-neutral-600 whitespace-pre-wrap">
                  {selectedReport.content}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="adminNotes"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Admin Notes (Optional)
              </label>
              <Textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="resize-none"
                rows={4}
                maxLength={1000}
                placeholder="Add internal notes about this report..."
              />
              <div className="text-xs text-neutral-500 mt-1">{adminNotes.length}/1000</div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={closeReportModal}
                className="min-h-[40px] flex-1 px-4"
              >
                Cancel
              </Button>

              <Button
                variant="gradient"
                onClick={() => updateReportStatus('resolved')}
                disabled={updating}
                className="min-h-[40px] flex-1 bg-green-600 px-4 hover:bg-green-700"
              >
                {updating ? (
                  'Updating…'
                ) : (
                  <>
                    <HiOutlineCheck className="w-4 h-4 mr-1" /> Mark Resolved
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => updateReportStatus('dismissed')}
                disabled={updating}
                className="min-h-[40px] flex-1 px-4"
              >
                {updating ? (
                  'Updating…'
                ) : (
                  <>
                    <HiOutlineX className="w-4 h-4 mr-1" /> Dismiss
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!reportToDelete}
        title="Delete report?"
        message="Are you sure you want to delete this report? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="destructive"
        isLoading={deleting}
        onCancel={() => setReportToDelete(null)}
        onConfirm={confirmDeleteReport}
      />
    </AdminPageShell>
  );
}
