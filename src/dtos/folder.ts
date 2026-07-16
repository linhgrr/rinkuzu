import { z } from 'zod';
import { objectIdRouteParamSchema, objectIdSchema } from '@/lib/validation/common';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';

export const folderIdSchema = objectIdSchema;
export const folderIdRouteParamsSchema = z.strictObject({ id: objectIdRouteParamSchema });
export const folderTargetSchema = z
  .union([z.literal(UNFILED_FOLDER_TARGET), folderIdSchema])
  .transform((target) => (target === UNFILED_FOLDER_TARGET ? null : target));
export const folderTargetRouteParamsSchema = z.strictObject({ id: folderTargetSchema });

export const createFolderRequestSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required').max(100),
});

export const assignQuizRequestSchema = z.object({
  quizId: objectIdSchema,
});

export interface FolderSummaryDto {
  id: string;
  name: string;
  quizCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolderListDto {
  folders: FolderSummaryDto[];
  unfiledCount: number;
}

export interface FolderAssignmentResultDto {
  quizId: string;
  folderId: string | null;
  assigned: true;
}
