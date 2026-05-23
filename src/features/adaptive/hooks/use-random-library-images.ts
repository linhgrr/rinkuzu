import { useEffect, useState } from 'react';
import { fetchApiData } from '@/lib/api/client';

const MIN_IMAGE_COUNT = 4;
const MAX_IMAGE_COUNT = 24;

export const useRandomLibraryImages = (count: number) => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    const requestedCount = Math.min(MAX_IMAGE_COUNT, Math.max(MIN_IMAGE_COUNT, count));
    let cancelled = false;

    const loadImages = async () => {
      try {
        const { images } = await fetchApiData<{ images: string[] }>(
          `/api/adaptive/library-images?limit=${requestedCount}`,
          { cache: 'no-store' },
        );

        if (!cancelled && Array.isArray(images)) {
          setImageUrls(images.filter((url) => typeof url === 'string' && url.length > 0));
        }
      } catch (error) {
        console.error('Failed to load random library images', error);
      }
    };

    void loadImages();

    return () => {
      cancelled = true;
    };
  }, [count]);

  return imageUrls;
};
