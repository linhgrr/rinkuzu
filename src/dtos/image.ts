export const IMAGE_UPLOAD_MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface ImageAssetDto {
  id: string;
  url: string;
  displayUrl: string;
  thumbnailUrl: string;
  mediumUrl?: string;
  deleteUrl: string;
  width: number;
  height: number;
  size: number;
}
