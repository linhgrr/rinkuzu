'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { fetchApiData } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import type { FolderSummary } from '../types';

interface AddFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (folder: FolderSummary) => void;
}

export function AddFolderModal({ isOpen, onClose, onCreated }: AddFolderModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
    }
  }, [isOpen]);

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
      const folder = await fetchApiData<FolderSummary>('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalizedName }),
      });
      onCreated(folder);
      onClose();
    } catch (requestError) {
      setError(extractUnknownErrorMessage(requestError, 'Failed to create folder'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add folder" size="small">
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
