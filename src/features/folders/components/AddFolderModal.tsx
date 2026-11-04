'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalActions } from '@/components/ui/ModalActions';
import { createFolderViewModel } from '@/features/folders/api/folders-api';
import { useApiErrorToast } from '@/lib/api/use-api-error';
import type { FolderSummaryViewModel } from '@/features/folders/types/folder-view-model';

interface AddFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (folder: FolderSummaryViewModel) => void;
}

export function AddFolderModal({ isOpen, onClose, onCreated }: AddFolderModalProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const showMutationError = useApiErrorToast();
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
      setError(t('folderNameRequired'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const folder = await createFolderViewModel(normalizedName);
      onCreated(folder);
      handleClose();
    } catch (requestError) {
      showMutationError(requestError);
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('addFolderTitle')} size="small">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="folder-name"
          label={t('folderName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          autoComplete="off"
          disabled={submitting}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ModalActions
          cancelText={tCommon('cancel')}
          confirmText={t('createFolder')}
          confirmType="submit"
          isDisabled={!name.trim()}
          isLoading={submitting}
          onCancel={handleClose}
        />
      </form>
    </Modal>
  );
}
