import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CreateFolderData,
  IFolderRepository,
} from '@/interfaces/repositories/IFolderRepository';
import type { Folder, FolderOverview, QuizFolderAccess } from '@/entities/Folder';
import { FolderNameConflictError } from '@/entities/Folder';
import { FolderService } from '@/services/folder/FolderService';

const now = new Date('2026-06-30T10:00:00.000Z');

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: '507f1f77bcf86cd799439011',
    name: 'Algorithms',
    ownerId: '507f191e810c19729de860ea',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FolderRepositoryStub implements IFolderRepository {
  listOverviewByOwner =
    vi.fn<(ownerId: string) => Promise<{ folders: FolderOverview[]; unfiledCount: number }>>();
  create = vi.fn<(data: CreateFolderData) => Promise<Folder>>();
  findOwnedById = vi.fn<(folderId: string, ownerId: string) => Promise<Folder | null>>();
  existsOwnedById = vi.fn<(folderId: string, ownerId: string) => Promise<boolean>>();
  rename = vi.fn<(folderId: string, ownerId: string, name: string) => Promise<Folder | null>>();
  deleteOwned = vi.fn<(folderId: string, ownerId: string) => Promise<boolean>>();
  findQuizAccess = vi.fn<(userId: string, quizId: string) => Promise<QuizFolderAccess | null>>();
  saveQuizPlacement =
    vi.fn<
      (
        userId: string,
        quizId: string,
        quizOwnerId: string,
        folderId: string | null,
      ) => Promise<void>
    >();
}

describe('FolderService', () => {
  let repository: FolderRepositoryStub;
  let service: FolderService;

  beforeEach(() => {
    repository = new FolderRepositoryStub();
    service = new FolderService(repository);
  });

  it('maps folder entities to stable response DTOs', async () => {
    repository.listOverviewByOwner.mockResolvedValue({
      folders: [{ ...folder(), quizCount: 3 }],
      unfiledCount: 2,
    });

    const result = await service.listFolders('507f191e810c19729de860ea');

    expect(result).toEqual({
      success: true,
      data: {
        folders: [
          {
            id: '507f1f77bcf86cd799439011',
            name: 'Algorithms',
            quizCount: 3,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
        unfiledCount: 2,
      },
    });
  });

  it('maps duplicate folder names to the existing 409 contract', async () => {
    repository.create.mockRejectedValue(new FolderNameConflictError());

    await expect(service.createFolder('507f191e810c19729de860ea', 'Algorithms')).resolves.toEqual({
      success: false,
      error: 'A folder with this name already exists',
      statusCode: 409,
    });
  });

  it('creates a folder and maps the entity to a DTO', async () => {
    repository.create.mockResolvedValue(folder());

    const result = await service.createFolder('507f191e810c19729de860ea', 'Algorithms');

    expect(repository.create).toHaveBeenCalledWith({
      ownerId: '507f191e810c19729de860ea',
      name: 'Algorithms',
    });
    expect(result).toEqual({
      success: true,
      data: {
        id: '507f1f77bcf86cd799439011',
        name: 'Algorithms',
        quizCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  });

  it('maps unexpected create failures to an internal error', async () => {
    repository.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.createFolder('507f191e810c19729de860ea', 'Algorithms')).resolves.toEqual({
      success: false,
      error: 'Failed to create folder',
      statusCode: 500,
    });
  });

  it('returns not found when renaming a folder outside the owner scope', async () => {
    repository.rename.mockResolvedValue(null);

    await expect(
      service.renameFolder('507f1f77bcf86cd799439011', '507f191e810c19729de860ea', 'New name'),
    ).resolves.toEqual({
      success: false,
      error: 'Folder not found',
      statusCode: 404,
    });
  });

  it('renames a folder and preserves the DTO contract', async () => {
    repository.rename.mockResolvedValue(folder({ name: 'Data structures' }));

    const result = await service.renameFolder(
      '507f1f77bcf86cd799439011',
      '507f191e810c19729de860ea',
      'Data structures',
    );

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Data structures');
  });

  it('maps rename conflicts to 409', async () => {
    repository.rename.mockRejectedValue(new FolderNameConflictError());

    await expect(
      service.renameFolder('507f1f77bcf86cd799439011', '507f191e810c19729de860ea', 'Algorithms'),
    ).resolves.toEqual({
      success: false,
      error: 'A folder with this name already exists',
      statusCode: 409,
    });
  });

  it('deletes an owned folder and reports missing folders', async () => {
    repository.deleteOwned.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      service.deleteFolder('507f1f77bcf86cd799439011', '507f191e810c19729de860ea'),
    ).resolves.toEqual({
      success: true,
      data: { id: '507f1f77bcf86cd799439011', deleted: true },
    });
    await expect(
      service.deleteFolder('507f1f77bcf86cd799439011', '507f191e810c19729de860ea'),
    ).resolves.toEqual({
      success: false,
      error: 'Folder not found',
      statusCode: 404,
    });
  });

  it('reports missing quizzes and target folders independently', async () => {
    repository.findQuizAccess.mockResolvedValueOnce(null).mockResolvedValueOnce({
      quizId: '507f1f77bcf86cd799439012',
      quizOwnerId: '507f191e810c19729de860ea',
      hasAttempt: false,
      hasProgress: false,
    });
    repository.findOwnedById.mockResolvedValue(null);

    await expect(
      service.assignQuiz(null, '507f1f77bcf86cd799439012', '507f191e810c19729de860ea'),
    ).resolves.toEqual({
      success: false,
      error: 'Quiz not found',
      statusCode: 404,
    });
    await expect(
      service.assignQuiz(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        '507f191e810c19729de860ea',
      ),
    ).resolves.toEqual({
      success: false,
      error: 'Folder not found',
      statusCode: 404,
    });
  });

  it('rejects external quizzes without attempt or progress access', async () => {
    repository.findOwnedById.mockResolvedValue(folder());
    repository.findQuizAccess.mockResolvedValue({
      quizId: '507f1f77bcf86cd799439012',
      quizOwnerId: '507f191e810c19729de860eb',
      hasAttempt: false,
      hasProgress: false,
    });

    const result = await service.assignQuiz(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
      '507f191e810c19729de860ea',
    );

    expect(result).toEqual({
      success: false,
      error: 'Only owned or completed quizzes can be added',
      statusCode: 403,
    });
    expect(repository.saveQuizPlacement).not.toHaveBeenCalled();
  });

  it('places an accessible external quiz through the repository port', async () => {
    repository.findOwnedById.mockResolvedValue(folder());
    repository.findQuizAccess.mockResolvedValue({
      quizId: '507f1f77bcf86cd799439012',
      quizOwnerId: '507f191e810c19729de860eb',
      hasAttempt: true,
      hasProgress: false,
    });
    repository.saveQuizPlacement.mockResolvedValue();

    const result = await service.assignQuiz(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
      '507f191e810c19729de860ea',
    );

    expect(result).toEqual({
      success: true,
      data: {
        quizId: '507f1f77bcf86cd799439012',
        folderId: '507f1f77bcf86cd799439011',
        assigned: true,
      },
    });
    expect(repository.saveQuizPlacement).toHaveBeenCalledWith(
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012',
      '507f191e810c19729de860eb',
      '507f1f77bcf86cd799439011',
    );
  });

  it('allows an owned quiz to move to the default folder', async () => {
    repository.findQuizAccess.mockResolvedValue({
      quizId: '507f1f77bcf86cd799439012',
      quizOwnerId: '507f191e810c19729de860ea',
      hasAttempt: false,
      hasProgress: false,
    });
    repository.saveQuizPlacement.mockResolvedValue();

    await expect(
      service.assignQuiz(null, '507f1f77bcf86cd799439012', '507f191e810c19729de860ea'),
    ).resolves.toEqual({
      success: true,
      data: {
        quizId: '507f1f77bcf86cd799439012',
        folderId: null,
        assigned: true,
      },
    });
    expect(repository.findOwnedById).not.toHaveBeenCalled();
    expect(repository.saveQuizPlacement).toHaveBeenCalledWith(
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012',
      '507f191e810c19729de860ea',
      null,
    );
  });
});
