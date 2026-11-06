import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AccountProfileUpdate,
  IAccountRepository,
} from '@/interfaces/repositories/IAccountRepository';
import type {
  IImageStorage,
  ImageUpload,
  ImageUploadResult,
} from '@/interfaces/services/IImageStorage';
import {
  ImageStorageConfigurationError,
  ImageStorageUpstreamError,
} from '@/interfaces/services/IImageStorage';
import type { AccountCredentials, AccountProfile } from '@/entities/Account';
import { AccountService } from '@/services/user/AccountService';
import { hashPassword, verifyPassword } from '@/lib/password';

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

const accountId = '507f191e810c19729de860ea';
const createdAt = new Date('2026-06-30T10:00:00.000Z');

function profile(overrides: Partial<AccountProfile> = {}): AccountProfile {
  return {
    id: accountId,
    email: 'user@example.com',
    displayName: 'Rin',
    bio: '',
    avatar: '',
    role: 'user',
    createdAt,
    ...overrides,
  };
}

class AccountRepositoryStub implements IAccountRepository {
  findProfileByEmail = vi.fn<(email: string) => Promise<AccountProfile | null>>();
  updateProfileByEmail =
    vi.fn<(email: string, update: AccountProfileUpdate) => Promise<AccountProfile | null>>();
  findCredentialsByEmail = vi.fn<(email: string) => Promise<AccountCredentials | null>>();
  updatePasswordHash = vi.fn<(email: string, passwordHash: string) => Promise<boolean>>();
  updateAvatar = vi.fn<(email: string, avatarUrl: string) => Promise<boolean>>();
  clearAvatar = vi.fn<(email: string) => Promise<boolean>>();
}

class ImageStorageStub implements IImageStorage {
  upload = vi.fn<(image: ImageUpload) => Promise<ImageUploadResult>>();
  // Optional provider delete is intentionally absent: avatar rows only store display URLs.
}

function uploadedImage(
  displayUrl = 'https://cdn.rinkuzu.app/images/avatar/2026/avatar.webp',
): ImageUploadResult {
  return {
    id: 'image-id',
    url: displayUrl,
    displayUrl,
    thumbnailUrl: displayUrl,
    deleteUrl: 'https://images.example/delete/image-id',
    width: 128,
    height: 128,
    size: 1024,
  };
}

describe('AccountService', () => {
  let repository: AccountRepositoryStub;
  let imageStorage: ImageStorageStub;
  let service: AccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AccountRepositoryStub();
    imageStorage = new ImageStorageStub();
    service = new AccountService(repository, imageStorage);
  });

  it('returns the same complete profile DTO for reads and updates', async () => {
    const account = profile({
      subscription: {
        planId: 'premium',
        planName: 'Premium',
        startDate: createdAt,
        endDate: new Date('2026-07-30T10:00:00.000Z'),
        isActive: true,
      },
    });
    repository.findProfileByEmail.mockResolvedValue(account);
    repository.updateProfileByEmail.mockResolvedValue(account);

    const read = await service.getProfile(account.email);
    const update = await service.updateProfile(account.email, { displayName: 'Rin' });

    expect(read).toEqual(update);
    expect(read).toEqual({
      success: true,
      data: {
        email: account.email,
        displayName: 'Rin',
        bio: '',
        avatar: '',
        role: 'user',
        createdAt: createdAt.toISOString(),
        subscription: {
          plan: { id: 'premium', name: 'Premium' },
          startDate: createdAt.toISOString(),
          endDate: '2026-07-30T10:00:00.000Z',
          isActive: true,
        },
      },
    });
  });

  it('reports missing profiles consistently', async () => {
    repository.findProfileByEmail.mockResolvedValue(null);
    repository.updateProfileByEmail.mockResolvedValue(null);

    await expect(service.getProfile('missing@example.com')).resolves.toEqual({
      success: false,
      error: 'User not found',
      statusCode: 404,
    });
    await expect(service.updateProfile('missing@example.com', {})).resolves.toEqual({
      success: false,
      error: 'User not found',
      statusCode: 404,
    });
  });

  it('rejects password changes for missing and OAuth accounts', async () => {
    repository.findCredentialsByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: accountId,
    });

    await expect(service.changePassword('missing@example.com', 'old', 'new')).resolves.toEqual({
      success: false,
      error: 'User not found',
      statusCode: 404,
    });
    await expect(service.changePassword('user@example.com', 'old', 'new')).resolves.toEqual({
      success: false,
      error: 'Password change is not available for this account',
      statusCode: 400,
      code: 'password_not_set',
    });
  });

  it('verifies and hashes passwords before persistence', async () => {
    repository.findCredentialsByEmail.mockResolvedValue({
      id: accountId,
      passwordHash: 'old-hash',
    });
    vi.mocked(verifyPassword).mockResolvedValue({
      valid: true,
      algorithm: 'argon2id',
      needsRehash: false,
    });
    vi.mocked(hashPassword).mockResolvedValue('new-hash');
    repository.updatePasswordHash.mockResolvedValue(true);

    await expect(
      service.changePassword('user@example.com', 'old-password', 'new-password'),
    ).resolves.toEqual({
      success: true,
      data: { email: 'user@example.com', passwordChanged: true },
    });
    expect(verifyPassword).toHaveBeenCalledWith('old-password', 'old-hash');
    expect(repository.updatePasswordHash).toHaveBeenCalledWith('user@example.com', 'new-hash');
  });

  it('rejects an incorrect current password', async () => {
    repository.findCredentialsByEmail.mockResolvedValue({
      id: accountId,
      passwordHash: 'old-hash',
    });
    vi.mocked(verifyPassword).mockResolvedValue({
      valid: false,
      algorithm: 'argon2id',
      needsRehash: false,
    });

    await expect(
      service.changePassword('user@example.com', 'wrong-password', 'new-password'),
    ).resolves.toEqual({
      success: false,
      error: 'Current password is incorrect',
      statusCode: 400,
    });
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('uploads an avatar through the image-storage port', async () => {
    repository.findProfileByEmail.mockResolvedValue(profile());
    imageStorage.upload.mockResolvedValue(uploadedImage());
    repository.updateAvatar.mockResolvedValue(true);

    const result = await service.uploadAvatar('user@example.com', {
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/webp',
    });

    expect(result).toEqual({
      success: true,
      data: { avatar: 'https://cdn.rinkuzu.app/images/avatar/2026/avatar.webp' },
    });
    expect(imageStorage.upload).toHaveBeenCalledWith({
      kind: 'avatar',
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/webp',
      filename: `avatar-${accountId}`,
    });
  });

  it('maps image storage failures to stable service statuses', async () => {
    repository.findProfileByEmail.mockResolvedValue(profile());
    imageStorage.upload
      .mockRejectedValueOnce(new ImageStorageConfigurationError())
      .mockRejectedValueOnce(new ImageStorageUpstreamError());

    await expect(
      service.uploadAvatar('user@example.com', {
        bytes: new Uint8Array(),
        contentType: 'image/png',
      }),
    ).resolves.toEqual({
      success: false,
      error: 'Image upload not configured',
      statusCode: 500,
    });
    await expect(
      service.uploadAvatar('user@example.com', {
        bytes: new Uint8Array(),
        contentType: 'image/png',
      }),
    ).resolves.toEqual({
      success: false,
      error: 'Image upload failed',
      statusCode: 502,
    });
  });

  it('clears an existing avatar and treats an empty avatar as idempotent', async () => {
    repository.findProfileByEmail
      .mockResolvedValueOnce(
        profile({ avatar: 'https://cdn.rinkuzu.app/images/avatar/2026/avatar.webp' }),
      )
      .mockResolvedValueOnce(profile());
    repository.clearAvatar.mockResolvedValue(true);

    await expect(service.deleteAvatar('user@example.com')).resolves.toEqual({
      success: true,
      data: { email: 'user@example.com', avatar: null, deleted: true },
    });
    await expect(service.deleteAvatar('user@example.com')).resolves.toEqual({
      success: true,
      data: { email: 'user@example.com', avatar: null, deleted: true },
    });
    expect(repository.clearAvatar).toHaveBeenCalledTimes(1);
    // Remote image delete is intentionally not attempted: only display URLs are
    // persisted on the user profile, not provider deleteUrl tokens.
    expect('deleteByUrl' in imageStorage).toBe(false);
  });
});
