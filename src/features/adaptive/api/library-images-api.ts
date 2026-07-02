import type { AdaptiveLibraryImagesDto } from '@/dtos/adaptive-library';
import { fetchApiData } from '@/lib/api/client';

export async function fetchAdaptiveLibraryImageUrls(limit: number): Promise<string[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const dto = await fetchApiData<AdaptiveLibraryImagesDto>(
    `/api/adaptive/library-images?${params}`,
    { cache: 'no-store' },
  );
  return dto.images.filter((url) => typeof url === 'string' && url.length > 0);
}
