'use client';

import { Link } from '@/i18n/navigation';
import { useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { FolderGridSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { HiOutlineDotsVertical, HiOutlineFolder, HiOutlinePlus } from 'react-icons/hi';
import { useApiErrorToast } from '@/lib/api/use-api-error';
import { deleteFolderViewModel, renameFolderViewModel } from '@/features/folders/api/folders-api';
import { AddFolderModal } from './AddFolderModal';
import { useFolders } from '../hooks/useFolders';
import type { FolderSummaryViewModel } from '@/features/folders/types/folder-view-model';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';

interface FoldersViewState {
  showAdd: boolean;
  renaming: FolderSummaryViewModel | null;
  renameValue: string;
  deleting: FolderSummaryViewModel | null;
  submitting: boolean;
}

type FoldersViewAction =
  | { type: 'openAdd' }
  | { type: 'closeAdd' }
  | { type: 'startRename'; folder: FolderSummaryViewModel }
  | { type: 'setRenameValue'; value: string }
  | { type: 'closeRename' }
  | { type: 'startDelete'; folder: FolderSummaryViewModel }
  | { type: 'closeDelete' }
  | { type: 'setSubmitting'; value: boolean };

const initialFoldersViewState: FoldersViewState = {
  showAdd: false,
  renaming: null,
  renameValue: '',
  deleting: null,
  submitting: false,
};

function foldersViewReducer(state: FoldersViewState, action: FoldersViewAction): FoldersViewState {
  switch (action.type) {
    case 'openAdd':
      return { ...state, showAdd: true };
    case 'closeAdd':
      return { ...state, showAdd: false };
    case 'startRename':
      return { ...state, renaming: action.folder, renameValue: action.folder.name };
    case 'setRenameValue':
      return { ...state, renameValue: action.value };
    case 'closeRename':
      return { ...state, renaming: null, renameValue: '' };
    case 'startDelete':
      return { ...state, deleting: action.folder };
    case 'closeDelete':
      return { ...state, deleting: null };
    case 'setSubmitting':
      return { ...state, submitting: action.value };
    default:
      return state;
  }
}

function FolderCard({
  folder,
  href,
  quizCountLabel,
  renameLabel,
  deleteLabel,
  actionsLabel,
  onRename,
  onDelete,
}: {
  folder: Pick<FolderSummaryViewModel, 'id' | 'name' | 'quizCount'>;
  href: string;
  quizCountLabel: string;
  renameLabel: string;
  deleteLabel: string;
  actionsLabel: string;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="relative min-h-36 rounded-xl border border-line-blue/40 bg-surface-blue p-5">
      <div className="flex items-start justify-between">
        <HiOutlineFolder className="size-8 text-brand-trust" />
        {onRename && onDelete ? (
          <details className="relative">
            <summary
              className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg hover:bg-white/70"
              aria-label={actionsLabel}
            >
              <HiOutlineDotsVertical className="size-5" />
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-line bg-white py-1 text-sm shadow-lg">
              <button
                type="button"
                onClick={onRename}
                className="w-full px-3 py-2 text-left hover:bg-neutral-50"
              >
                {renameLabel}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
              >
                {deleteLabel}
              </button>
            </div>
          </details>
        ) : null}
      </div>
      <Link href={href} className="mt-5 block">
        <h3 className="truncate font-semibold text-ink">{folder.name}</h3>
        <p className="mt-1 text-sm text-ink/55">{quizCountLabel}</p>
      </Link>
    </article>
  );
}

export function FoldersView() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const { folders, unfiledCount, isLoading, error, mutate } = useFolders();
  const [state, dispatch] = useReducer(foldersViewReducer, initialFoldersViewState);
  const showMutationError = useApiErrorToast();

  async function renameFolder() {
    if (!state.renaming || !state.renameValue.trim()) return;
    dispatch({ type: 'setSubmitting', value: true });
    try {
      await renameFolderViewModel(state.renaming.id, state.renameValue.trim());
      await mutate();
      dispatch({ type: 'closeRename' });
      toast.success(t('folderRenamed'));
    } catch (requestError) {
      showMutationError(requestError);
    }
    dispatch({ type: 'setSubmitting', value: false });
  }

  async function deleteFolder() {
    if (!state.deleting) return;
    dispatch({ type: 'setSubmitting', value: true });
    try {
      await deleteFolderViewModel(state.deleting.id);
      await mutate();
      dispatch({ type: 'closeDelete' });
      toast.success(t('folderDeleted'));
    } catch (requestError) {
      showMutationError(requestError);
    }
    dispatch({ type: 'setSubmitting', value: false });
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => mutate()} />;
  }

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button onClick={() => dispatch({ type: 'openAdd' })}>
          <HiOutlinePlus className="size-4" /> {t('newFolder')}
        </Button>
      </div>
      {isLoading ? (
        <FolderGridSkeleton label={t('loadingFolders')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FolderCard
            folder={{ id: UNFILED_FOLDER_TARGET, name: t('myFolder'), quizCount: unfiledCount }}
            href={`/my-quizzes/folder/${UNFILED_FOLDER_TARGET}`}
            quizCountLabel={t('folderQuizCount', { count: unfiledCount })}
            renameLabel={t('renameFolder')}
            deleteLabel={t('deleteFolder')}
            actionsLabel={t('folderActions')}
          />
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              href={`/my-quizzes/folder/${folder.id}`}
              quizCountLabel={t('folderQuizCount', { count: folder.quizCount })}
              renameLabel={t('renameFolder')}
              deleteLabel={t('deleteFolder')}
              actionsLabel={t('folderActions')}
              onRename={() => dispatch({ type: 'startRename', folder })}
              onDelete={() => dispatch({ type: 'startDelete', folder })}
            />
          ))}
        </div>
      )}

      <AddFolderModal
        isOpen={state.showAdd}
        onClose={() => dispatch({ type: 'closeAdd' })}
        onCreated={() => void mutate()}
      />
      <Modal
        isOpen={!!state.renaming}
        onClose={() => dispatch({ type: 'closeRename' })}
        title={t('renameFolderTitle')}
        size="small"
      >
        <div className="space-y-4">
          <Input
            label={t('folderName')}
            value={state.renameValue}
            onChange={(event) => dispatch({ type: 'setRenameValue', value: event.target.value })}
            maxLength={100}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => dispatch({ type: 'closeRename' })}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={() => void renameFolder()}
              loading={state.submitting}
              disabled={!state.renameValue.trim()}
            >
              {tCommon('save')}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        isOpen={!!state.deleting}
        title={t('deleteFolderTitle')}
        message={t('deleteFolderConfirm', { name: state.deleting?.name ?? '' })}
        confirmText={t('deleteFolder')}
        confirmVariant="destructive"
        isLoading={state.submitting}
        onCancel={() => dispatch({ type: 'closeDelete' })}
        onConfirm={() => void deleteFolder()}
      />
    </>
  );
}
