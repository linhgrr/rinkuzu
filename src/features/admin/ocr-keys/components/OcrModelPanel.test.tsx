import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchSettingsMock, updateModelMock } = vi.hoisted(() => ({
  fetchSettingsMock: vi.fn(),
  updateModelMock: vi.fn(),
}));

const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/features/admin/ocr-keys/api/admin-ocr-keys-api', () => ({
  fetchAdminOcrModelSettings: fetchSettingsMock,
  updateAdminOcrModel: updateModelMock,
}));
const describeError = vi.hoisted(() => (_error: unknown, fallback: string) => fallback);
vi.mock('@/lib/api/use-api-error', () => ({ useAdminApiErrorMessage: () => describeError }));

import { OcrModelPanel } from './OcrModelPanel';

describe('OcrModelPanel initial load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('leaves the loading skeleton when the settings request fails', async () => {
    fetchSettingsMock.mockRejectedValue(new Error('network down'));

    const { container } = render(<OcrModelPanel />);

    expect(await screen.findByText('ocrModelLoadError')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the saved model once the settings load', async () => {
    fetchSettingsMock.mockResolvedValue({
      provider: 'fake-provider',
      modelName: 'fake-ocr-model',
      source: 'database',
      envFallbackModel: 'fake-default-model',
      updatedAt: null,
      updatedBy: null,
    });

    const { container } = render(<OcrModelPanel />);

    expect(await screen.findByDisplayValue('fake-ocr-model')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
