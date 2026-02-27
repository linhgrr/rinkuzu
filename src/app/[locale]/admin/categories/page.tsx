'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import Sidebar from '@/components/Sidebar';
import {
  HiChevronDown,
  HiOutlineMenu,
  HiOutlineLogout,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlinePencil,
  HiOutlineTrash
} from '@/components/icons';

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
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
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
    color: '#3B82F6',
    isActive: true
  });

  const fetchCategories = useCallback(async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
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
    } catch (error) {
      setError('An error occurred while fetching categories');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchCategories(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchCategories(newPage, searchTerm);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      isActive: true
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
      isActive: category.isActive
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
    } catch (error) {
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
    } catch (error) {
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
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation - giống như trang admin khác */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <div className="h-10 flex items-center justify-center">
                  <img src="https://i.ibb.co/WWGXBZXm/image-removebg-preview.png" alt="RinKuzu Logo" className="h-10 w-auto object-contain" />
                </div>
              </Link>
              <span className="ml-3 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                {t('admin')}
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                {t('allQuizzes')}
              </Link>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {session?.user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <HiChevronDown className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                    <button
                      onClick={() => signOut()}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t('loggingOut')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900"
              >
                <HiOutlineMenu className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-4">
              <div className="space-y-2">
                <Link href="/" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                  {t('allQuizzes')}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="block w-full text-left px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  {t('loggingOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main className={`py-8 transition-all duration-300 ${session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : ''
        } max-w-none px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('categories')}</h1>
              <p className="mt-2 text-gray-600">
                {t('manageQuizCategories')}
              </p>
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
                    setPagination(prev => ({ ...prev, page: 1 }));
                    fetchCategories(1, '');
                  }}
                >
                  {tCommon('clear')}
                </Button>
              )}
            </form>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-6">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-12">
              <div className="text-gray-500">{t('loadingStatistics')}</div>
            </div>
          )}

          {/* Categories Table */}
          {!loading && categories.length > 0 && (
            <Card className="mb-8">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('category')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('description')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('status')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('created')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categories.map((category) => (
                        <tr key={category._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div
                                className="w-4 h-4 rounded-full mr-3"
                                style={{ backgroundColor: category.color }}
                              ></div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {category.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {category.description || t('noDescription')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${category.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                              }`}>
                              {category.isActive ? t('active') : t('inactive')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>{formatDate(category.createdAt)}</div>
                            <div className="text-xs">by {category.createdBy.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(category)}
                            >
                              <HiOutlinePencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCategoryToDelete(category)}
                              className="text-red-600 hover:text-red-700"
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
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noCategoriesFound')}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm
                  ? t('tryAdjustingSearch')
                  : t('getStartedCategory')
                }
              </p>
              {!searchTerm && (
                <div className="mt-6">
                  <Button onClick={openCreateModal}>
                    <HiOutlinePlus className="w-4 h-4 mr-2" /> {t('addCategory')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
              <div className="flex flex-1 justify-between sm:hidden">
                <Button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  variant="outline"
                >
                  {tCommon('previous')}
                </Button>
                <Button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  variant="outline"
                >
                  {tCommon('next')}
                </Button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    {tCommon('showingResults', {
                      from: ((pagination.page - 1) * pagination.limit) + 1,
                      to: Math.min(pagination.page * pagination.limit, pagination.total),
                      total: pagination.total
                    })}
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <Button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      variant="outline"
                      size="sm"
                      className="rounded-r-none"
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
                          variant={pagination.page === pageNum ? "default" : "outline"}
                          size="sm"
                          className="rounded-none"
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
                      className="rounded-l-none"
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
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('nameRequired')}
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('enterCategoryName')}
                  required
                  maxLength={50}
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('descriptionOptional')}
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('enterCategoryDescription')}
                  maxLength={200}
                  rows={3}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('color')}
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-8 rounded border border-gray-300"
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  {t('activeStatus')}
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModals}
                  disabled={submitting}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={submitting}
                >
                  {editingCategory ? t('updateCategory') : t('createCategory')}
                </Button>
              </div>
            </form>
          </Modal>

          <ConfirmModal
            isOpen={!!categoryToDelete}
            title={t('deleteCategory')}
            message={categoryToDelete ? t('deleteCategoryConfirm', { name: categoryToDelete.name }) : ''}
            confirmText={t('delete')}
            confirmVariant="destructive"
            isLoading={deleting}
            onCancel={() => setCategoryToDelete(null)}
            onConfirm={confirmDeleteCategory}
          />
        </div>
      </main>
    </div>
  );
}
