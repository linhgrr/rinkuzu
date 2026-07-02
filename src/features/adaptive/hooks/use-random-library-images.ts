import { useEffect, useState } from 'react';
import { fetchAdaptiveLibraryImageUrls } from '@/features/adaptive/api/library-images-api';

const MIN_IMAGE_COUNT = 4;
const MAX_IMAGE_COUNT = 24;

export const useRandomLibraryImages = (count: number) => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    const requestedCount = Math.min(MAX_IMAGE_COUNT, Math.max(MIN_IMAGE_COUNT, count));
    let cancelled = false;

    const loadImages = async () => {
      try {
        const images = await fetchAdaptiveLibraryImageUrls(requestedCount);

        if (!cancelled) {
          setImageUrls(images);
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
