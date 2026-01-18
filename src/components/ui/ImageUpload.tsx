import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { uploadImageToImgBB } from '@/services/imageUploadService';
import { Button } from './Button';
import { useTranslation } from '@/lib/i18n';

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
  placeholder,
  maxWidth = 400,
  maxHeight = 300,
  className = ""
}: ImageUploadProps) {
  const { text } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const defaultPlaceholder = text({
    en: 'Click to upload, drag & drop, or paste image (Ctrl+V)',
    vi: 'Bấm để tải lên, kéo thả hoặc dán ảnh (Ctrl+V)',
  });
  const [dragActive, setDragActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(text({ en: 'Please select an image file', vi: 'Vui lòng chọn tệp hình ảnh' }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error(text({ en: 'Image file size must be less than 10MB', vi: 'Kích thước ảnh phải nhỏ hơn 10MB' }));
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadImageToImgBB(file, file.name);
      onImageUploaded(result.displayUrl);
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      toast.error(`${text({ en: 'Failed to upload image', vi: 'Không thể tải ảnh lên' })}: ${error.message}`);
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

  // Global paste handler for hover-based pasting
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      if (!isHovered) return;
      
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
    };

    window.addEventListener('paste', onWindowPaste);
    
    return () => {
      window.removeEventListener('paste', onWindowPaste);
    };
  }, [isHovered, handleImageUpload]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (currentImage) {
    return (
      <div 
        className={`relative group ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
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
            <span className="text-sm text-gray-600">
              {text({ en: 'Uploading image...', vi: 'Đang tải ảnh lên...' })}
            </span>
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
              <span className="font-medium text-blue-600">{text({ en: 'Click to upload', vi: 'Bấm để tải lên' })}</span>
              <span> {text({ en: 'or drag and drop', vi: 'hoặc kéo thả' })}</span>
            </div>
            <p className="text-xs text-gray-500">
              {placeholder ?? defaultPlaceholder}
            </p>
            <p className="text-xs text-gray-400">
              {text({ en: 'PNG, JPG, GIF up to 10MB', vi: 'PNG, JPG, GIF tối đa 10MB' })}
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
  const { text } = useTranslation();
  return (
    <ImageUpload
      {...props}
      placeholder={text({ en: 'Add image to question (optional)', vi: 'Thêm ảnh cho câu hỏi (không bắt buộc)' })}
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
  const { text } = useTranslation();
  return (
    <ImageUpload
      {...props}
      placeholder={text({ en: 'Add image to option (optional)', vi: 'Thêm ảnh cho lựa chọn (không bắt buộc)' })}
      maxWidth={200}
      maxHeight={150}
      className="mt-2"
    />
  );
} 
