import React, { useState } from 'react';
import Image from 'next/image';

interface ImageDisplayProps {
  src?: string;
  alt: string;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
  fallback?: React.ReactNode;
}

export function ImageDisplay({
  src,
  alt,
  className = '',
  maxWidth = 400,
  maxHeight = 300,
  fallback,
}: ImageDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!src || imageError) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-neutral-100 rounded-lg"
          style={{ width: maxWidth, height: maxHeight }}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={maxWidth}
        height={maxHeight}
        className={`rounded-lg shadow-sm border border-neutral-200 ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        style={{
          maxWidth: '100%',
          height: 'auto',
          objectFit: 'contain',
        }}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImageError(true);
          setIsLoading(false);
        }}
        unoptimized // For external URLs
      />
    </div>
  );
}

interface QuestionImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function QuestionImage({ src, alt, className = '' }: QuestionImageProps) {
  return (
    <ImageDisplay
      src={src}
      alt={alt}
      className={`mb-4 ${className}`}
      maxWidth={600}
      maxHeight={400}
      fallback={
        <div className="text-sm text-neutral-500 italic mb-4">
          Question contains an image that couldn&apos;t be loaded
        </div>
      }
    />
  );
}

interface OptionImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function OptionImage({ src, alt, className = '' }: OptionImageProps) {
  return (
    <ImageDisplay
      src={src}
      alt={alt}
      className={`ml-2 ${className}`}
      maxWidth={200}
      maxHeight={150}
      fallback={<div className="text-xs text-neutral-400 italic ml-2">Image option</div>}
    />
  );
}
