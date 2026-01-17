// /src/app/draft/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDraftStore } from '@/store/useDraftStore';
import { toast } from 'sonner';
import {
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineDesktopComputer,
  HiOutlineArrowLeft,
} from '@/components/icons';
import Link from 'next/link';

interface DraftQuestion {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
}

interface Draft {
  _id: string;
  title: string;
  categoryId?: string;
  questions: DraftQuestion[];
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface Category {
  _id: string;
  name: string;
}

export default function DraftEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { removeDraft } = useDraftStore();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch categories
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  // Fetch draft
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    fetchDraft();
  }, [id, session, authStatus]);

  const fetchDraft = async () => {
    try {
      const response = await fetch(`/api/draft/${id}`);
      if (!response.ok) throw new Error('Draft not found');

      const { draft: fetchedDraft } = await response.json();
      setDraft(fetchedDraft);
      setQuestions(fetchedDraft.questions);
      setTitle(fetchedDraft.title);
      setCategoryId(fetchedDraft.categoryId || '');
    } catch (error) {
      toast.error('Không tìm thấy draft');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionEdit = (index: number, updates: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!categoryId) {
      toast.error('Vui lòng chọn danh mục');
      return;
    }

    if (questions.length === 0) {
      toast.error('Cần ít nhất 1 câu hỏi');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/draft/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          categoryId,
          description,
          questions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit');
      }

      const { slug } = await response.json();

      // Remove from store
      removeDraft(id as string);

      toast.success('Quiz đã được gửi để duyệt!');
      router.push(`/quiz/${slug}`);
    } catch (error: any) {
      toast.error('Lỗi', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mobile redirect message
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-5">
          <HiOutlineDesktopComputer className="w-10 h-10 text-blue-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Mở trên máy tính</h1>
        <p className="text-gray-500 mb-6 max-w-xs">
          Để chỉnh sửa chi tiết câu hỏi, vui lòng sử dụng máy tính.
        </p>
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-blue-500 text-white font-medium
                     hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
          Về trang chủ
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <HiOutlineArrowLeft className="w-4 h-4" />
            Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Chỉnh sửa Quiz</h1>
          <p className="text-gray-500 mt-1">
            {questions.length} câu hỏi được trích xuất
          </p>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Thông tin cơ bản</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tên Quiz *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên quiz..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mô tả
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về quiz..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Danh mục *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Chọn danh mục...</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Câu hỏi ({questions.length})
          </h2>

          <div className="space-y-4">
            {questions.map((q, index) => (
              <QuestionEditor
                key={index}
                index={index}
                question={q}
                onEdit={(updates) => handleQuestionEdit(index, updates)}
                onDelete={() => handleDeleteQuestion(index)}
              />
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700
                     hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !categoryId || questions.length === 0}
            className="px-6 py-3 rounded-xl bg-blue-500 text-white font-medium
                     hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi để duyệt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Question Editor Component
function QuestionEditor({
  index,
  question,
  onEdit,
  onDelete,
}: {
  index: number;
  question: DraftQuestion;
  onEdit: (updates: Partial<DraftQuestion>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(question.question);

  const handleSave = () => {
    onEdit({ question: editedQuestion });
    setIsEditing(false);
  };

  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <span className="text-xs font-medium text-gray-500 uppercase">
            Câu {index + 1} • {question.type === 'single' ? 'Một đáp án' : 'Nhiều đáp án'}
          </span>

          {isEditing ? (
            <div className="mt-2 flex items-start gap-2">
              <textarea
                value={editedQuestion}
                onChange={(e) => setEditedQuestion(e.target.value)}
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handleSave}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
              >
                <HiOutlineCheck className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <p className="mt-1 text-gray-900">{question.question}</p>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <HiOutlinePencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Options preview */}
      <div className="space-y-1.5">
        {question.options.map((opt, optIdx) => {
          const isCorrect = question.type === 'single'
            ? question.correctIndex === optIdx
            : question.correctIndexes?.includes(optIdx);

          return (
            <div
              key={optIdx}
              className={`px-3 py-2 rounded-lg text-sm ${
                isCorrect
                  ? 'bg-green-100 text-green-800'
                  : 'bg-white text-gray-600'
              }`}
            >
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}
