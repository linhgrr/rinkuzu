import React, { useState, useRef, useCallback } from 'react';
import { uploadImageToImgBB } from '@/services/imageUploadService';
import { Button } from './Button';

interface ImageUploadProps {
  currentImage?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
  placeholder?: string;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
}

export function ImageUpload({
  currentImage,
  onImageUploaded,
  onImageRemoved,
  placeholder = "Click to upload, drag & drop, or paste image (Ctrl+V)",
  maxWidth = 400,
  maxHeight = 300,
  className = ""
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('Image file size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadImageToImgBB(file, file.name);
      onImageUploaded(result.displayUrl);
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  }, [onImageUploaded]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleImageUpload(file);
          break;
        }
      }
    }
  }, [handleImageUpload]);

  // --- Hover-based global paste listener ---
  const onWindowPaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleImageUpload(file);
          e.preventDefault();
          break;
        }
      }
    }
  }, [handleImageUpload]);

  const handleMouseEnter = () => {
    window.addEventListener('paste', onWindowPaste);
  };

  const handleMouseLeave = () => {
    window.removeEventListener('paste', onWindowPaste);
  };

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (currentImage) {
    return (
      <div className={`relative group ${className}`}>
        <img
          src={currentImage}
          alt="Uploaded image"
          className="rounded-lg border border-gray-200 shadow-sm"
          style={{
            maxWidth: maxWidth,
            maxHeight: maxHeight,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain'
          }}
        />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            onClick={onImageRemoved}
            variant="ghost"
            size="sm"
            className="bg-red-600 text-white hover:bg-red-700 rounded-full w-8 h-8 p-0"
          >
            ✕
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        tabIndex={0}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500
          ${dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : ''}
        `}
        style={{ minHeight: '120px' }}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Uploading image...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 48 48"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              />
            </svg>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-blue-600">Click to upload</span>
              <span> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500">
              {placeholder}
            </p>
            <p className="text-xs text-gray-400">
              PNG, JPG, GIF up to 10MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Specialized components for question and option images
interface QuestionImageUploadProps {
  currentImage?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
}

export function QuestionImageUpload(props: QuestionImageUploadProps) {
  return (
    <ImageUpload
      {...props}
      placeholder="Add image to question (optional)"
      maxWidth={600}
      maxHeight={400}
      className="w-full"
    />
  );
}

interface OptionImageUploadProps {
  currentImage?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
}

export function OptionImageUpload(props: OptionImageUploadProps) {
  return (
    <ImageUpload
      {...props}
      placeholder="Add image to option (optional)"
      maxWidth={200}
      maxHeight={150}
      className="mt-2"
    />
  );
} 