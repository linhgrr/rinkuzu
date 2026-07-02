import React, { useState } from 'react';
import Image from 'next/image';

interface ImageDisplayProps {
  src?: string;
  alt: string;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
  emptyState?: React.ReactNode;
}

export function ImageDisplay({
  src,
  alt,
  className = '',
  maxWidth = 400,
  maxHeight = 300,
  emptyState,
}: ImageDisplayProps) {
  if (!src) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <ImageDisplayContent
      key={src}
      src={src}
      alt={alt}
      className={className}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      emptyState={emptyState}
    />
  );
}

interface ImageDisplayContentProps extends Required<Pick<ImageDisplayProps, 'src' | 'alt'>> {
  className: string;
  maxWidth: number;
  maxHeight: number;
  emptyState?: React.ReactNode;
}

function ImageDisplayContent({
  src,
  alt,
  className,
  maxWidth,
  maxHeight,
  emptyState,
}: ImageDisplayContentProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  if (status === 'error') {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {status === 'loading' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-neutral-100 rounded-lg"
          style={{ width: maxWidth, height: maxHeight }}
        >
          <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={maxWidth}
        height={maxHeight}
        className={`rounded-lg shadow-sm border border-neutral-200 ${status === 'loading' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        style={{
          maxWidth: '100%',
          height: 'auto',
          objectFit: 'contain',
        }}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
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
      emptyState={
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
      emptyState={<div className="text-xs text-neutral-400 italic ml-2">Image option</div>}
    />
  );
}
