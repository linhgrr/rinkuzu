'use client';

import { FormEvent, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalActions } from '@/components/ui/ModalActions';
import { createFolderViewModel } from '@/features/folders/api/folders-api';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import type { FolderSummaryViewModel } from '@/features/folders/types/folder-view-model';

interface AddFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (folder: FolderSummaryViewModel) => void;
}

export function AddFolderModal({ isOpen, onClose, onCreated }: AddFolderModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName('');
    setError('');
    setSubmitting(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Folder name is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const folder = await createFolderViewModel(normalizedName);
      onCreated(folder);
      handleClose();
    } catch (requestError) {
      setError(extractUnknownErrorMessage(requestError, 'Failed to create folder'));
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add folder" size="small">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="folder-name"
          label="Folder name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          autoComplete="off"
          disabled={submitting}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ModalActions
          cancelText="Cancel"
          confirmText="Create"
          confirmType="submit"
          isDisabled={!name.trim()}
          isLoading={submitting}
          onCancel={handleClose}
        />
      </form>
    </Modal>
  );
}
