'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDraftStore } from '@/store/useDraftStore';
import { fetchApiData } from '@/lib/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import {
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineDesktopComputer,
  HiOutlineArrowLeft,
  HiOutlineEyeOff,
  HiOutlineDocumentText,
  HiOutlineCloudUpload,
  HiOutlineQuestionMarkCircle,
  HiOutlineCollection,
} from '@/components/icons';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import QuizMetaForm from '@/features/quiz/components/QuizMetaForm';

const PDFViewer = dynamic(() => import('@/features/quiz/components/PDFViewer'), { ssr: false });

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
  pdfData?: {
    fileName: string;
    pdfUrl?: string;
  };
}

interface Category {
  _id: string;
  name: string;
  description?: string;
  color?: string;
}

interface Props {
  initialDraft: Draft;
  initialCategory: Category | null;
  locale: string;
}

export default function DraftEditClient({ initialDraft, initialCategory, locale }: Props) {
  const t = useTranslations('create');
  const _tCommon = useTranslations('common');
  const router = useRouter();
  const { removeDraft } = useDraftStore();

  const [questions, setQuestions] = useState<DraftQuestion[]>(initialDraft.questions || []);
  const [title, setTitle] = useState(initialDraft.title || '');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(initialCategory);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // PDF viewer state
  const [pdfUrl, _setPdfUrl] = useState<string | null>(initialDraft.pdfData?.pdfUrl || null);
  const [showPDFViewer, setShowPDFViewer] = useState(true);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);

  // Load PDF Data from URL
  useEffect(() => {
    let objectUrl: string | null = null;
    const loadPdfData = async () => {
      if (!pdfUrl) {
        setPdfDataUrl(null);
        return;
      }

      try {
        const res = await fetch(pdfUrl);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setPdfDataUrl(objectUrl);
      } catch (err) {
        console.error('Error loading PDF data:', err);
        setPdfDataUrl(null);
      }
    };

    loadPdfData();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pdfUrl]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleQuestionEdit = (index: number, updates: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      toast.error('Vui lòng chọn danh mục');
      return;
    }

    if (questions.length === 0) {
      toast.error('Cần ít nhất 1 câu hỏi');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await fetchApiData<{
        quizId: string;
        slug: string;
        warnings: string[];
      }>(`/api/draft/${initialDraft._id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          categoryId: selectedCategory._id,
          description,
          questions,
          pdfUrl,
          isPrivate,
        }),
      });

      // Remove from store
      removeDraft(initialDraft._id);

      toast.success('Quiz đã được gửi để duyệt!');
      router.push(`/${locale}/quiz/${data.slug}`);
    } catch (error: any) {
      toast.error('Lỗi', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mobile redirect message
  if (isMobile) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-6 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <HiOutlineDesktopComputer className="w-10 h-10 text-brand-trust" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 mb-2">Mở trên máy tính</h1>
        <p className="text-neutral-500 mb-6 max-w-xs">
          Để chỉnh sửa chi tiết câu hỏi, vui lòng sử dụng máy tính.
        </p>
        <Link
          href={`/${locale}`}
          className="px-6 py-3 rounded-full bg-green-500 text-white font-medium
                     hover:bg-brand-trust transition-colors inline-flex items-center gap-2"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
          Về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex">
        {/* Left Side - Form Content */}
        <div
          className={`transition-[width] duration-300 ${showPDFViewer && pdfUrl ? 'w-1/2' : 'w-full'}`}
        >
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <Link
                href={`/${locale}`}
                className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 mb-4"
              >
                <HiOutlineArrowLeft className="w-4 h-4" />
                Quay lại
              </Link>
              <h1 className="text-2xl font-bold text-neutral-900">Chỉnh sửa Quiz</h1>
              <p className="text-neutral-500 mt-1 flex items-center gap-2">
                <HiOutlineQuestionMarkCircle className="w-4 h-4" />
                {questions.length} câu hỏi được trích xuất
              </p>
            </div>

            {/* Basic Info using shared generic QuizMetaForm */}
            <QuizMetaForm
              title={title}
              onTitleChange={setTitle}
              description={description}
              onDescriptionChange={setDescription}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              labels={{
                title: t('quizTitle'),
                titlePlaceholder: t('enterTitle'),
                description: t('descriptionOptional'),
                descriptionPlaceholder: t('provideContext'),
                category: t('category'),
                categoryPlaceholder: t('searchSelectCategory'),
                privateLabel: t('privateQuiz'),
                privateDescription: t('privateQuizDescription'),
              }}
              isPrivate={isPrivate}
              onPrivateChange={setIsPrivate}
              disabled={isSubmitting}
            />

            {/* Questions */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <HiOutlineCollection className="w-5 h-5 text-brand-trust" />
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
            <div className="flex items-center justify-between gap-3">
              {/* PDF Viewer Toggle */}
              {pdfUrl && (
                <Button
                  onClick={() => setShowPDFViewer(!showPDFViewer)}
                  variant="outline"
                  className="flex items-center gap-2 text-brand-trust border-green-200 hover:bg-green-50"
                >
                  {showPDFViewer ? (
                    <>
                      <HiOutlineEyeOff className="w-4 h-4" /> Ẩn PDF
                    </>
                  ) : (
                    <>
                      <HiOutlineDocumentText className="w-4 h-4" /> Xem PDF
                    </>
                  )}
                </Button>
              )}
              <div className="flex gap-3 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${locale}`)}
                  className="flex items-center gap-2 px-6 py-3 text-neutral-700 hover:bg-neutral-50"
                >
                  <HiOutlineX className="w-4 h-4" />
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedCategory || questions.length === 0}
                  className="flex items-center gap-2 px-6 py-3"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HiOutlineCloudUpload className="w-5 h-5" />
                  )}
                  {isSubmitting ? 'Đang gửi…' : 'Gửi để duyệt'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - PDF Viewer */}
        {showPDFViewer && pdfUrl && (
          <div className="w-1/2 h-screen sticky top-0 p-4 bg-white border-l border-neutral-200">
            <PDFViewer
              pdfDataUrl={pdfDataUrl}
              pdfUrl={pdfUrl}
              onClose={() => setShowPDFViewer(false)}
              showHeader={false}
            />
          </div>
        )}
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
    <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <span className="text-xs font-medium text-neutral-500 uppercase flex items-center gap-1.5">
            <div className="w-5 h-5 bg-green-100 text-brand-trust rounded-full flex items-center justify-center text-[10px]">
              {index + 1}
            </div>
            Câu {index + 1} • {question.type === 'single' ? 'Một đáp án' : 'Nhiều đáp án'}
          </span>

          {isEditing ? (
            <div className="mt-2 flex items-start gap-2">
              <Textarea
                value={editedQuestion}
                onChange={(e) => setEditedQuestion(e.target.value)}
                rows={2}
                className="flex-1 resize-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleSave}
                className="text-green-600 hover:bg-green-50"
              >
                <HiOutlineCheck className="w-5 h-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(false)}
                className="text-neutral-400 hover:bg-neutral-100"
              >
                <HiOutlineX className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-neutral-900">{question.question}</p>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="text-neutral-400 hover:bg-green-50 hover:text-brand-trust"
            >
              <HiOutlinePencil className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-neutral-400 hover:bg-red-50 hover:text-red-500"
            >
              <HiOutlineTrash className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Options preview */}
      <div className="space-y-1.5">
        {question.options.map((opt, optIdx) => {
          const isCorrect =
            question.type === 'single'
              ? question.correctIndex === optIdx
              : question.correctIndexes?.includes(optIdx);

          return (
            <div
              key={optIdx}
              className={`px-3 py-2 rounded-lg text-sm ${
                isCorrect ? 'bg-green-100 text-green-800' : 'bg-white text-neutral-600'
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
