'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDraftStore } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineUpload,
  HiOutlineDocumentText,
  HiOutlineArrowRight,
  HiOutlineDesktopComputer,
  HiOutlineX,
} from '@/components/icons';
import { toast } from 'sonner';

export default function MobileCreatePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { addDraft } = useDraftStore();
  const { startProcessing } = usePdfProcessor();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      const f = acceptedFiles[0];
      setFile(f);
      setTitle(f.name.replace(/\.pdf$/i, ''));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: isUploading,
  });

  const handleSubmit = async () => {
    if (!file || !title.trim() || !session?.user) return;

    setIsUploading(true);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Create draft via API
      const response = await fetch('/api/draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          pdfBase64: base64,
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create draft');
      }

      const { draftId, chunks, totalPages, expiresAt } = await response.json();

      // Add to store
      addDraft({
        id: draftId,
        title: title.trim(),
        status: 'processing',
        chunksTotal: chunks.total,
        chunksProcessed: 0,
        chunksError: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt,
      });

      // Start background processing
      startProcessing(draftId, chunks.chunkDetails, title.trim());

      toast.success('Đang xử lý PDF', {
        description: `${totalPages} trang, ${chunks.total} phần`,
      });

      // Navigate away
      router.push('/');

    } catch (error: any) {
      toast.error('Lỗi', { description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tạo Quiz mới</h1>
        <p className="text-gray-500 mt-1">Upload PDF và để AI tạo câu hỏi</p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          relative rounded-2xl border-2 border-dashed p-8
          flex flex-col items-center justify-center
          min-h-[200px] transition-all duration-200 cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
          ${file ? 'border-green-500 bg-green-50' : ''}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center"
            >
              <HiOutlineDocumentText className="w-14 h-14 text-green-500 mx-auto" />
              <p className="mt-3 font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setTitle('');
                }}
                className="mt-3 inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
              >
                <HiOutlineX className="w-4 h-4" />
                Chọn file khác
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center"
            >
              <HiOutlineUpload className="w-14 h-14 text-gray-400 mx-auto" />
              <p className="mt-3 font-medium text-gray-700">
                {isDragActive ? 'Thả file vào đây' : 'Chọn hoặc kéo thả PDF'}
              </p>
              <p className="text-sm text-gray-500">Tối đa 50MB</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Title Input */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-5"
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tên Quiz
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên quiz..."
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200
                         bg-white text-gray-900 placeholder-gray-400
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-200"
              disabled={isUploading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      <AnimatePresence>
        {file && title.trim() && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleSubmit}
            disabled={isUploading}
            className="w-full mt-6 py-4 rounded-full bg-blue-500 text-white
                       font-semibold flex items-center justify-center gap-2
                       hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50
                       transition-all duration-200"
          >
            {isUploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang tải lên...
              </>
            ) : (
              <>
                Tạo Quiz
                <HiOutlineArrowRight className="w-5 h-5" />
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Desktop Hint */}
      <div className="mt-8 p-4 rounded-xl bg-gray-100 flex items-start gap-3">
        <HiOutlineDesktopComputer className="w-6 h-6 text-gray-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-700">Cần chỉnh sửa chi tiết?</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Mở trên máy tính để edit câu hỏi, thêm hình ảnh, và nhiều tùy chọn khác.
          </p>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
