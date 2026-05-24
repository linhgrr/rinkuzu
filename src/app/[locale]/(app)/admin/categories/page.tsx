'use client';

import { useReducer } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { ModalActions } from '@/components/ui/ModalActions';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { PaginationMeta } from '@/types';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from '@/components/icons';
import { fetchApiData } from '@/lib/api/client';

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

interface CategoryFormState {
  name: string;
  description: string;
  color: string;
  isActive: boolean;
}

interface AdminCategoriesState {
  searchTerm: string;
  page: number;
  localError: string;
  modalMode: 'closed' | 'create' | 'edit';
  editingCategory: Category | null;
  submitting: boolean;
  categoryToDelete: Category | null;
  deleting: boolean;
  formData: CategoryFormState;
}

type AdminCategoriesAction =
  | { type: 'patch'; value: Partial<AdminCategoriesState> }
  | { type: 'setSearchTerm'; value: string }
  | { type: 'setPage'; value: number }
  | { type: 'setFormField'; field: keyof CategoryFormState; value: string | boolean }
  | { type: 'openCreate' }
  | { type: 'openEdit'; value: Category }
  | { type: 'closeModal' };

const ITEMS_PER_PAGE = 20;

const initialFormData: CategoryFormState = {
  name: '',
  description: '',
  color: '#009d8c',
  isActive: true,
};

const initialState: AdminCategoriesState = {
  searchTerm: '',
  page: 1,
  localError: '',
  modalMode: 'closed',
  editingCategory: null,
  submitting: false,
  categoryToDelete: null,
  deleting: false,
  formData: initialFormData,
};

function adminCategoriesReducer(
  state: AdminCategoriesState,
  action: AdminCategoriesAction,
): AdminCategoriesState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'setSearchTerm':
      return { ...state, searchTerm: action.value };
    case 'setPage':
      return { ...state, page: action.value };
    case 'setFormField':
      return {
        ...state,
        formData: { ...state.formData, [action.field]: action.value },
      };
    case 'openCreate':
      return {
        ...state,
        modalMode: 'create',
        editingCategory: null,
        formData: initialFormData,
      };
    case 'openEdit':
      return {
        ...state,
        modalMode: 'edit',
        editingCategory: action.value,
        formData: {
          name: action.value.name,
          description: action.value.description,
          color: action.value.color,
          isActive: action.value.isActive,
        },
      };
    case 'closeModal':
      return {
        ...state,
        modalMode: 'closed',
        editingCategory: null,
        formData: initialFormData,
      };
    default:
      return state;
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function AdminCategoriesHeader({
  title,
  description,
  addLabel,
  onAdd,
}: {
  title: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-2 text-neutral-600">{description}</p>
      </div>
      <Button onClick={onAdd}>
        <HiOutlinePlus className="mr-2 size-4" /> {addLabel}
      </Button>
    </div>
  );
}

function AdminCategoriesSearchBar({
  placeholder,
  searchLabel,
  searchingLabel,
  clearLabel,
  searchTerm,
  isLoading,
  onSearchChange,
  onSubmit,
  onClear,
}: {
  placeholder: string;
  searchLabel: string;
  searchingLabel: string;
  clearLabel: string;
  searchTerm: string;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-8">
      <form onSubmit={onSubmit} className="flex max-w-2xl gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full"
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? searchingLabel : searchLabel}
        </Button>
        {searchTerm ? (
          <Button type="button" variant="outline" onClick={onClear}>
            {clearLabel}
          </Button>
        ) : null}
      </form>
    </div>
  );
}

function CategoriesTable({
  categories,
  noDescriptionLabel,
  categoryLabel,
  descriptionLabel,
  statusLabel,
  createdLabel,
  actionsLabel,
  activeLabel,
  inactiveLabel,
  onEdit,
  onDelete,
}: {
  categories: Category[];
  noDescriptionLabel: string;
  categoryLabel: string;
  descriptionLabel: string;
  statusLabel: string;
  createdLabel: string;
  actionsLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {categoryLabel}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {descriptionLabel}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {statusLabel}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {createdLabel}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {actionsLabel}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {categories.map((category) => (
                <tr key={category._id}>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <div
                        className="mr-3 size-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="text-sm font-medium text-neutral-900">{category.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-neutral-900">
                      {category.description || noDescriptionLabel}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-semibold ${
                        category.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {category.isActive ? activeLabel : inactiveLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-500">
                    <div>{formatDate(category.createdAt)}</div>
                    <div className="text-sm text-neutral-500">
                      by {category.createdBy?.email || 'Unknown'}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <div className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(category)}
                        className="min-h-[36px] px-3"
                      >
                        <HiOutlinePencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(category)}
                        className="min-h-[36px] px-3 text-red-600 hover:text-red-700"
                      >
                        <HiOutlineTrash className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoriesPagination({
  pagination,
  previousLabel,
  nextLabel,
  showingResultsLabel,
  onPageChange,
}: {
  pagination: PaginationMeta;
  previousLabel: string;
  nextLabel: string;
  showingResultsLabel: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="rounded-lg border-t border-neutral-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <Button
          onClick={() => onPageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage <= 1}
          variant="outline"
          className="min-h-[40px] px-4"
        >
          {previousLabel}
        </Button>
        <Button
          onClick={() => onPageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage >= pagination.totalPages}
          variant="outline"
          className="min-h-[40px] px-4"
        >
          {nextLabel}
        </Button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-neutral-700">{showingResultsLabel}</p>
        </div>
        <div>
          <nav
            className="isolate inline-flex -space-x-px rounded-md shadow-sm"
            aria-label="Pagination"
          >
            <Button
              onClick={() => onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
              variant="outline"
              size="sm"
              className="min-h-[36px] rounded-r-none px-3"
            >
              {previousLabel}
            </Button>

            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => {
              let pageNum;
              if (pagination.totalPages <= 5) {
                pageNum = index + 1;
              } else if (pagination.currentPage <= 3) {
                pageNum = index + 1;
              } else if (pagination.currentPage >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + index;
              } else {
                pageNum = pagination.currentPage - 2 + index;
              }

              return (
                <Button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  variant={pagination.currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  className="min-h-[36px] rounded-none px-3"
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              onClick={() => onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages}
              variant="outline"
              size="sm"
              className="min-h-[36px] rounded-l-none px-3"
            >
              {nextLabel}
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}

function CategoryFormModal({
  isOpen,
  title,
  formData,
  submitting,
  cancelLabel,
  submitLabel,
  nameLabel,
  descriptionLabel,
  colorLabel,
  activeLabel,
  namePlaceholder,
  descriptionPlaceholder,
  onClose,
  onSubmit,
  onFormFieldChange,
}: {
  isOpen: boolean;
  title: string;
  formData: CategoryFormState;
  submitting: boolean;
  cancelLabel: string;
  submitLabel: string;
  nameLabel: string;
  descriptionLabel: string;
  colorLabel: string;
  activeLabel: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onFormFieldChange: (field: keyof CategoryFormState, value: string | boolean) => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="medium">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-neutral-700">
            {nameLabel}
          </label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(event) => onFormFieldChange('name', event.target.value)}
            placeholder={namePlaceholder}
            required
            maxLength={50}
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-neutral-700">
            {descriptionLabel}
          </label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(event) => onFormFieldChange('description', event.target.value)}
            placeholder={descriptionPlaceholder}
            maxLength={200}
            rows={3}
            className="text-sm"
          />
        </div>

        <div>
          <label htmlFor="color" className="mb-1 block text-sm font-medium text-neutral-700">
            {colorLabel}
          </label>
          <div className="flex items-center gap-x-3">
            <input
              id="color"
              type="color"
              aria-label={colorLabel}
              value={formData.color}
              onChange={(event) => onFormFieldChange('color', event.target.value)}
              className="h-8 w-12 rounded border border-neutral-300"
            />
            <Input
              type="text"
              value={formData.color}
              onChange={(event) => onFormFieldChange('color', event.target.value)}
              placeholder="#009d8c"
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            id="isActive"
            type="checkbox"
            aria-label={activeLabel}
            checked={formData.isActive}
            onChange={(event) => onFormFieldChange('isActive', event.target.checked)}
            className="size-4 rounded border-neutral-300 text-brand-trust focus:ring-brand-trust"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-neutral-900">
            {activeLabel}
          </label>
        </div>

        <div className="pt-4">
          <ModalActions
            cancelText={cancelLabel}
            confirmText={submitLabel}
            onCancel={onClose}
            confirmType="submit"
            isLoading={submitting}
          />
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCategoriesPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(adminCategoriesReducer, initialState);

  const queryParams = new URLSearchParams({
    page: state.page.toString(),
    limit: ITEMS_PER_PAGE.toString(),
  });
  if (state.searchTerm.trim()) {
    queryParams.append('search', state.searchTerm.trim());
  }

  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/categories?${queryParams}`,
    fetchApiData<{ categories: Category[]; pagination: PaginationMeta }>,
  );

  const categories = data?.categories ?? [];
  const pagination = data?.pagination ?? {
    currentPage: state.page,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: ITEMS_PER_PAGE,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'setPage', value: 1 });
  };

  const closeModals = () => {
    dispatch({ type: 'closeModal' });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!state.formData.name.trim()) {
      dispatch({ type: 'patch', value: { localError: 'Category name is required' } });
      return;
    }

    dispatch({ type: 'patch', value: { submitting: true } });
    try {
      const url = state.editingCategory
        ? `/api/admin/categories/${state.editingCategory._id}`
        : '/api/admin/categories';
      const method = state.editingCategory ? 'PUT' : 'POST';

      await fetchApiData(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(state.formData),
      });
      await mutate();
      closeModals();
      dispatch({ type: 'patch', value: { localError: '' } });
    } catch (submitError) {
      dispatch({
        type: 'patch',
        value: {
          localError:
            submitError instanceof Error
              ? submitError.message
              : 'An error occurred while saving category',
        },
      });
    } finally {
      dispatch({ type: 'patch', value: { submitting: false } });
    }
  };

  const deleteCategory = async (category: Category) => {
    try {
      dispatch({ type: 'patch', value: { deleting: true } });
      await fetchApiData(`/api/admin/categories/${category._id}`, {
        method: 'DELETE',
      });
      await mutate();
      dispatch({ type: 'patch', value: { localError: '' } });
    } catch (deleteError) {
      dispatch({
        type: 'patch',
        value: {
          localError:
            deleteError instanceof Error
              ? deleteError.message
              : 'An error occurred while deleting category',
        },
      });
    } finally {
      dispatch({ type: 'patch', value: { deleting: false } });
    }
  };

  const confirmDeleteCategory = async () => {
    if (!state.categoryToDelete) return;
    await deleteCategory(state.categoryToDelete);
    dispatch({ type: 'patch', value: { categoryToDelete: null } });
  };

  const showingResultsLabel = tCommon('showingResults', {
    from: (pagination.currentPage - 1) * pagination.itemsPerPage + 1,
    to: Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems),
    total: pagination.totalItems,
  });

  return (
    <AdminPageShell>
      <div className="mx-auto max-w-6xl">
        <AdminCategoriesHeader
          title={t('categories')}
          description={t('manageQuizCategories')}
          addLabel={t('addCategory')}
          onAdd={() => dispatch({ type: 'openCreate' })}
        />

        <AdminCategoriesSearchBar
          placeholder={t('searchCategories')}
          searchLabel={t('search')}
          searchingLabel={t('searching')}
          clearLabel={tCommon('clear')}
          searchTerm={state.searchTerm}
          isLoading={isLoading}
          onSearchChange={(value) => dispatch({ type: 'setSearchTerm', value })}
          onSubmit={handleSearch}
          onClear={() => {
            dispatch({ type: 'setSearchTerm', value: '' });
            dispatch({ type: 'setPage', value: 1 });
          }}
        />

        {error || state.localError ? (
          <ErrorState message={error?.message || state.localError || ''} className="mb-6" />
        ) : null}

        {isLoading ? <LoadingState text={t('loadingStatistics')} /> : null}

        {!isLoading && categories.length > 0 ? (
          <CategoriesTable
            categories={categories}
            noDescriptionLabel={t('noDescription')}
            categoryLabel={t('category')}
            descriptionLabel={t('description')}
            statusLabel={t('status')}
            createdLabel={t('created')}
            actionsLabel={t('actions')}
            activeLabel={t('active')}
            inactiveLabel={t('inactive')}
            onEdit={(category) => dispatch({ type: 'openEdit', value: category })}
            onDelete={(category) =>
              dispatch({ type: 'patch', value: { categoryToDelete: category } })
            }
          />
        ) : null}

        {!isLoading && categories.length === 0 ? (
          <EmptyState
            title={t('noCategoriesFound')}
            description={state.searchTerm ? t('tryAdjustingSearch') : t('getStartedCategory')}
            action={
              !state.searchTerm ? (
                <Button onClick={() => dispatch({ type: 'openCreate' })}>
                  <HiOutlinePlus className="mr-2 size-4" /> {t('addCategory')}
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {!isLoading && pagination.totalPages > 1 ? (
          <CategoriesPagination
            pagination={pagination}
            previousLabel={tCommon('previous')}
            nextLabel={tCommon('next')}
            showingResultsLabel={showingResultsLabel}
            onPageChange={(page) => dispatch({ type: 'setPage', value: page })}
          />
        ) : null}

        <CategoryFormModal
          isOpen={state.modalMode !== 'closed'}
          title={state.editingCategory ? t('editCategory') : t('createCategory')}
          formData={state.formData}
          submitting={state.submitting}
          cancelLabel={t('cancel')}
          submitLabel={state.editingCategory ? t('updateCategory') : t('createCategory')}
          nameLabel={t('nameRequired')}
          descriptionLabel={t('descriptionOptional')}
          colorLabel={t('color')}
          activeLabel={t('activeStatus')}
          namePlaceholder={t('enterCategoryName')}
          descriptionPlaceholder={t('enterCategoryDescription')}
          onClose={closeModals}
          onSubmit={handleSubmit}
          onFormFieldChange={(field, value) => dispatch({ type: 'setFormField', field, value })}
        />

        <ConfirmModal
          isOpen={!!state.categoryToDelete}
          title={t('deleteCategory')}
          message={
            state.categoryToDelete
              ? t('deleteCategoryConfirm', { name: state.categoryToDelete.name })
              : ''
          }
          confirmText={t('delete')}
          confirmVariant="destructive"
          isLoading={state.deleting}
          onCancel={() => dispatch({ type: 'patch', value: { categoryToDelete: null } })}
          onConfirm={confirmDeleteCategory}
        />
      </div>
    </AdminPageShell>
  );
}
