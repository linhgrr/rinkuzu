'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { IReport } from '@/models/Report';

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<IReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<IReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      router.push('/');
      return;
    }

    fetchReports();
  }, [session, status, router, statusFilter]);

  const fetchReports = async () => {
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
  };

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
          adminNotes: adminNotes.trim()
        }),
      });

      if (response.ok) {
        fetchReports();
        closeReportModal();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update report');
      }
    } catch (error) {
      console.error('Error updating report:', error);
      alert('Failed to update report');
    } finally {
      setUpdating(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
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
        alert(error.error || 'Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case 'pending':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case 'resolved':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Resolved</span>;
      case 'dismissed':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Dismissed</span>;
      default:
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>{status}</span>;
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading reports...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath="/admin/reports"
      />
      
      {/* Main content */}
      <div className={`transition-all duration-300 ${
        session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : ''
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quiz Reports Management</h1>
          <p className="mt-2 text-gray-600">Manage and review user reports about quiz content</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['all', 'pending', 'resolved', 'dismissed'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'gradient' : 'outline'}
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status === 'all' ? 'All Reports' : status}
            </Button>
          ))}
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {reports.length === 0 ? (
            <Card className="p-12 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Reports Found</h3>
              <p className="text-gray-500">
                {statusFilter === 'all' 
                  ? 'No reports have been submitted yet.'
                  : `No ${statusFilter} reports found.`
                }
              </p>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report._id} className="hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {report.quizTitle}
                        </h3>
                        {getStatusBadge(report.status)}
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-4 mb-1">
                          <span>
                            <strong>Reporter:</strong> {report.reporterName} ({report.reporterEmail})
                          </span>
                          <span>
                            <strong>Date:</strong> {formatDate(report.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {report.content}
                        </p>
                      </div>

                      {report.adminNotes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                          <p className="text-sm font-medium text-blue-900 mb-1">Admin Notes:</p>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">
                            {report.adminNotes}
                          </p>
                        </div>
                      )}

                      {report.resolvedAt && report.resolvedBy && (
                        <div className="text-xs text-gray-500">
                          Resolved by {report.resolvedBy} on {formatDate(report.resolvedAt)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        variant="gradient"
                        onClick={() => openReportModal(report)}
                      >
                        Review
                      </Button>
                      
                      <Link href={`/edit/${report.quizId}`}>
                        <Button
                          variant="accent"
                          className="w-full"
                        >
                          Edit Quiz
                        </Button>
                      </Link>
                      
                      <Button
                        variant="outline"
                        onClick={() => deleteReport(report._id!)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      </div>

      {/* Report Review Modal */}
      <Modal isOpen={showModal} onClose={closeReportModal} title="Review Report">
        {selectedReport && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">{selectedReport.quizTitle}</h3>
              <div className="text-sm text-gray-600 mb-3">
                <div><strong>Reporter:</strong> {selectedReport.reporterName} ({selectedReport.reporterEmail})</div>
                <div><strong>Date:</strong> {formatDate(selectedReport.createdAt)}</div>
                <div><strong>Status:</strong> {getStatusBadge(selectedReport.status)}</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Report Content:</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {selectedReport.content}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Notes (Optional)
              </label>
              <textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                maxLength={1000}
                placeholder="Add internal notes about this report..."
              />
              <div className="text-xs text-gray-500 mt-1">
                {adminNotes.length}/1000
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={closeReportModal}
                className="flex-1"
              >
                Cancel
              </Button>
              
              <Button
                variant="gradient"
                onClick={() => updateReportStatus('resolved')}
                disabled={updating}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {updating ? 'Updating...' : 'Mark Resolved'}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => updateReportStatus('dismissed')}
                disabled={updating}
                className="flex-1"
              >
                {updating ? 'Updating...' : 'Dismiss'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
} 