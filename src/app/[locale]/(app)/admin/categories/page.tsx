'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from '@/components/icons';

interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
  isActive: boolean;
  createdBy: {
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminCategoriesPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#009d8c',
    isActive: true,
  });

  const fetchCategories = useCallback(
    async (page: number = 1, search: string = '') => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
        });

        if (search.trim()) {
          params.append('search', search.trim());
        }

        const response = await fetch(`/api/admin/categories?${params}`);
        const data = await response.json();

        if (data.success) {
          setCategories(data.data.categories);
          setPagination(data.data.pagination);
          setError('');
        } else {
          setError(data.error || 'Failed to fetch categories');
        }
      } catch (_error) {
        setError('An error occurred while fetching categories');
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit],
  );

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCategories(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchCategories(newPage, searchTerm);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#009d8c',
      isActive: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (category: Category) => {
    setFormData({
      name: category.name,
      description: category.description,
      color: category.color,
      isActive: category.isActive,
    });
    setEditingCategory(category);
    setShowEditModal(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingCategory(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory._id}`
        : '/api/admin/categories';

      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        fetchCategories(pagination.page, searchTerm);
        closeModals();
        setError('');
      } else {
        setError(data.error || 'Failed to save category');
      }
    } catch (_error) {
      setError('An error occurred while saving category');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/admin/categories/${category._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        fetchCategories(pagination.page, searchTerm);
        setError('');
      } else {
        setError(data.error || 'Failed to delete category');
      }
    } catch (_error) {
      setError('An error occurred while deleting category');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    await deleteCategory(categoryToDelete);
    setCategoryToDelete(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AdminPageShell>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">{t('categories')}</h1>
            <p className="mt-2 text-neutral-600">{t('manageQuizCategories')}</p>
          </div>
          <Button onClick={openCreateModal}>
            <HiOutlinePlus className="w-4 h-4 mr-2" /> {t('addCategory')}
          </Button>
        </div>

        {/* Search */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="flex gap-4 max-w-2xl">
            <div className="flex-1">
              <Input
                type="text"
                placeholder={t('searchCategories')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? t('searching') : t('search')}
            </Button>
            {searchTerm && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                  fetchCategories(1, '');
                }}
              >
                {tCommon('clear')}
              </Button>
            )}
          </form>
        </div>

        {/* Error */}
        {error && <ErrorState message={error} className="mb-6" />}

        {/* Loading */}
        {loading && <LoadingState text={t('loadingStatistics')} />}

        {/* Categories Table */}
        {!loading && categories.length > 0 && (
          <Card className="mb-8">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        {t('category')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        {t('description')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        {t('status')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        {t('created')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        {t('actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {categories.map((category) => (
                      <tr key={category._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-3"
                              style={{ backgroundColor: category.color }}
                            ></div>
                            <div>
                              <div className="text-sm font-medium text-neutral-900">
                                {category.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-900">
                            {category.description || t('noDescription')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-semibold ${
                              category.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {category.isActive ? t('active') : t('inactive')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                          <div>{formatDate(category.createdAt)}</div>
                          <div className="text-sm text-neutral-500">
                            by {category.createdBy?.email || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(category)}
                            className="min-h-[36px] px-3"
                          >
                            <HiOutlinePencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCategoryToDelete(category)}
                            className="min-h-[36px] px-3 text-red-600 hover:text-red-700"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {!loading && categories.length === 0 && (
          <EmptyState
            title={t('noCategoriesFound')}
            description={searchTerm ? t('tryAdjustingSearch') : t('getStartedCategory')}
            action={
              !searchTerm ? (
                <Button onClick={openCreateModal}>
                  <HiOutlinePlus className="w-4 h-4 mr-2" /> {t('addCategory')}
                </Button>
              ) : undefined
            }
          />
        )}

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                variant="outline"
                className="min-h-[40px] px-4"
              >
                {tCommon('previous')}
              </Button>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                variant="outline"
                className="min-h-[40px] px-4"
              >
                {tCommon('next')}
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-neutral-700">
                  {tCommon('showingResults', {
                    from: (pagination.page - 1) * pagination.limit + 1,
                    to: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total,
                  })}
                </p>
              </div>
              <div>
                <nav
                  className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                  aria-label="Pagination"
                >
                  <Button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    variant="outline"
                    size="sm"
                    className="min-h-[36px] rounded-r-none px-3"
                  >
                    {tCommon('previous')}
                  </Button>

                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        variant={pagination.page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="min-h-[36px] rounded-none px-3"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    variant="outline"
                    size="sm"
                    className="min-h-[36px] rounded-l-none px-3"
                  >
                    {tCommon('next')}
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal
          isOpen={showCreateModal || showEditModal}
          onClose={closeModals}
          title={editingCategory ? t('editCategory') : t('createCategory')}
          size="medium"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">
                {t('nameRequired')}
              </label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('enterCategoryName')}
                required
                maxLength={50}
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                {t('descriptionOptional')}
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('enterCategoryDescription')}
                maxLength={200}
                rows={3}
                className="text-sm"
              />
            </div>

            <div>
              <label htmlFor="color" className="block text-sm font-medium text-neutral-700 mb-1">
                {t('color')}
              </label>
              <div className="flex items-center space-x-3">
                <input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-8 rounded border border-neutral-300"
                />
                <Input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  placeholder="#009d8c"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 text-brand-trust focus:ring-brand-trust border-neutral-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-neutral-900">
                {t('activeStatus')}
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeModals}
                disabled={submitting}
                className="min-h-[40px] px-4"
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                loading={submitting}
                disabled={submitting}
                className="min-h-[40px] px-4"
              >
                {editingCategory ? t('updateCategory') : t('createCategory')}
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmModal
          isOpen={!!categoryToDelete}
          title={t('deleteCategory')}
          message={
            categoryToDelete ? t('deleteCategoryConfirm', { name: categoryToDelete.name }) : ''
          }
          confirmText={t('delete')}
          confirmVariant="destructive"
          isLoading={deleting}
          onCancel={() => setCategoryToDelete(null)}
          onConfirm={confirmDeleteCategory}
        />
      </div>
    </AdminPageShell>
  );
}
