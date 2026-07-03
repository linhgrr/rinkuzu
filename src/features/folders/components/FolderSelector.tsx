'use client';

import { useEffect, useRef, useState } from 'react';
import { HiOutlineFolder, HiOutlinePlus } from 'react-icons/hi';
import { DropdownListSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { cn } from '@/lib/utils';
import { AddFolderModal } from './AddFolderModal';
import { useFolders } from '../hooks/useFolders';
import type { FolderSummaryViewModel } from '@/features/folders/types/folder-view-model';

interface FolderSelectorProps {
  value: string | null;
  onChange: (folderId: string | null) => void;
  disabled?: boolean;
}

export function FolderSelector({ value, onChange, disabled = false }: FolderSelectorProps) {
  const { folders, isLoading, mutate } = useFolders();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = folders.find((folder) => folder.id === value);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function select(folderId: string | null) {
    onChange(folderId);
    setOpen(false);
  }

  async function handleCreated(folder: FolderSummaryViewModel) {
    await mutate();
    onChange(folder.id);
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-neutral-300 bg-white px-4 text-left text-sm text-neutral-900 transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
        >
          <span className="flex items-center gap-2">
            <HiOutlineFolder className="size-5 text-brand-trust" />
            {selected?.name ?? 'My folder'}
          </span>
          <span aria-hidden="true" className="text-neutral-400">
            ⌄
          </span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitemradio"
              aria-checked={value === null}
              onClick={() => select(null)}
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-50',
                value === null && 'bg-green-50 text-brand-trust',
              )}
            >
              My folder
            </button>
            {isLoading ? <DropdownListSkeleton label="Loading folders" rows={2} /> : null}
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                role="menuitemradio"
                aria-checked={value === folder.id}
                onClick={() => select(folder.id)}
                className={cn(
                  'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-50',
                  value === folder.id && 'bg-green-50 text-brand-trust',
                )}
              >
                {folder.name}
              </button>
            ))}
            <div className="mt-1 border-t border-neutral-100 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowAdd(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-trust hover:bg-green-50"
              >
                <HiOutlinePlus className="size-4" /> Add folder
              </button>
            </div>
          </div>
        )}
      </div>
      <AddFolderModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
