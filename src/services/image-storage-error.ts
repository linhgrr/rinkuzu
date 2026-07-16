import {
  ImageStorageConfigurationError,
  ImageStorageUpstreamError,
} from '@/interfaces/services/IImageStorage';
import type { ServiceFailure } from '@/interfaces/services/types';

export function toImageStorageFailure(error: unknown): ServiceFailure | null {
  if (error instanceof ImageStorageConfigurationError) {
    return { success: false, error: error.message, statusCode: 500 };
  }
  if (error instanceof ImageStorageUpstreamError) {
    return { success: false, error: error.message, statusCode: 502 };
  }
  return null;
}
