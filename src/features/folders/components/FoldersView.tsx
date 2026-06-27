'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { HiOutlineDotsVertical, HiOutlineFolder, HiOutlinePlus } from '@/components/icons';
import { fetchApiData } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { AddFolderModal } from './AddFolderModal';
import { useFolders } from '../hooks/useFolders';
import type { FolderSummary } from '../types';

function FolderCard({
  folder,
  href,
  onRename,
  onDelete,
}: {
  folder: Pick<FolderSummary, '_id' | 'name' | 'quizCount'>;
  href: string;
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
              aria-label="Folder actions"
            >
              <HiOutlineDotsVertical className="size-5" />
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-line bg-white py-1 text-sm shadow-lg">
              <button
                type="button"
                onClick={onRename}
                className="w-full px-3 py-2 text-left hover:bg-neutral-50"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </details>
        ) : null}
      </div>
      <Link href={href} className="mt-5 block">
        <h3 className="truncate font-semibold text-ink">{folder.name}</h3>
        <p className="mt-1 text-sm text-ink/55">
          {folder.quizCount} {folder.quizCount === 1 ? 'quiz' : 'quizzes'}
        </p>
      </Link>
    </article>
  );
}

export function FoldersView() {
  const { folders, unfiledCount, isLoading, error, mutate } = useFolders();
  const [showAdd, setShowAdd] = useState(false);
  const [renaming, setRenaming] = useState<FolderSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<FolderSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function renameFolder() {
    if (!renaming || !renameValue.trim()) return;
    setSubmitting(true);
    try {
      await fetchApiData(`/api/folders/${renaming._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      await mutate();
      setRenaming(null);
      toast.success('Folder renamed');
    } catch (requestError) {
      toast.error(extractUnknownErrorMessage(requestError, 'Failed to rename folder'));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteFolder() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await fetchApiData(`/api/folders/${deleting._id}`, { method: 'DELETE' });
      await mutate();
      setDeleting(null);
      toast.success('Folder deleted. Its quizzes were moved to My folder.');
    } catch (requestError) {
      toast.error(extractUnknownErrorMessage(requestError, 'Failed to delete folder'));
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Failed to load folders.</p>;
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Folders</h2>
          <p className="text-sm text-ink/55">Organize your quizzes into personal folders.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <HiOutlinePlus className="size-4" /> New folder
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl bg-surface-blue" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FolderCard
            folder={{ _id: 'default', name: 'My folder', quizCount: unfiledCount }}
            href="/my-quizzes/folder/default"
          />
          {folders.map((folder) => (
            <FolderCard
              key={folder._id}
              folder={folder}
              href={`/my-quizzes/folder/${folder._id}`}
              onRename={() => {
                setRenameValue(folder.name);
                setRenaming(folder);
              }}
              onDelete={() => setDeleting(folder)}
            />
          ))}
        </div>
      )}

      <AddFolderModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => void mutate()}
      />
      <Modal
        isOpen={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename folder"
        size="small"
      >
        <div className="space-y-4">
          <Input
            label="Folder name"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            maxLength={100}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void renameFolder()}
              loading={submitting}
              disabled={!renameValue.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        isOpen={!!deleting}
        title="Delete folder"
        message={`Delete “${deleting?.name ?? ''}”? Its quizzes will move to My folder.`}
        confirmText="Delete"
        confirmVariant="destructive"
        isLoading={submitting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void deleteFolder()}
      />
    </>
  );
}
