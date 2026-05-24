'use client';

import { useEffect, useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { useDraftStore } from '@/store/useDraftStore';
import { fetchApiData } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
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

interface DraftEditorState {
  questions: DraftQuestion[];
  title: string;
  description: string;
  isPrivate: boolean;
  selectedCategory: Category | null;
  showPDFViewer: boolean;
}

type DraftEditorAction =
  | { type: 'setTitle'; value: string }
  | { type: 'setDescription'; value: string }
  | { type: 'setIsPrivate'; value: boolean }
  | { type: 'setSelectedCategory'; value: Category | null }
  | { type: 'setShowPDFViewer'; value: boolean }
  | { type: 'updateQuestion'; index: number; updates: Partial<DraftQuestion> }
  | { type: 'deleteQuestion'; index: number };

function draftEditorReducer(state: DraftEditorState, action: DraftEditorAction): DraftEditorState {
  switch (action.type) {
    case 'setTitle':
      return { ...state, title: action.value };
    case 'setDescription':
      return { ...state, description: action.value };
    case 'setIsPrivate':
      return { ...state, isPrivate: action.value };
    case 'setSelectedCategory':
      return { ...state, selectedCategory: action.value };
    case 'setShowPDFViewer':
      return { ...state, showPDFViewer: action.value };
    case 'updateQuestion':
      return {
        ...state,
        questions: state.questions.map((question, index) =>
          index === action.index ? { ...question, ...action.updates } : question,
        ),
      };
    case 'deleteQuestion':
      return {
        ...state,
        questions: state.questions.filter((_, index) => index !== action.index),
      };
    default:
      return state;
  }
}

export default function DraftEditClient({ initialDraft, initialCategory, locale }: Props) {
  const t = useTranslations('create');
  const _tCommon = useTranslations('common');
  const { push } = useRouter();
  const { removeDraft } = useDraftStore();
  const [state, dispatch] = useReducer(draftEditorReducer, {
    questions: initialDraft.questions || [],
    title: initialDraft.title || '',
    description: '',
    isPrivate: false,
    selectedCategory: initialCategory,
    showPDFViewer: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pdfUrl = initialDraft.pdfData?.pdfUrl || null;
  const { data: pdfDataUrl } = useSWR(
    pdfUrl ? ['draft-edit-pdf', pdfUrl] : null,
    async ([, url]: [string, string]) => {
      // EXTERNAL: object storage PDF fetch
      const res = await fetch(url);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    {
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    return () => {
      if (pdfDataUrl) {
        URL.revokeObjectURL(pdfDataUrl);
      }
    };
  }, [pdfDataUrl]);

  const handleQuestionEdit = (index: number, updates: Partial<DraftQuestion>) => {
    dispatch({ type: 'updateQuestion', index, updates });
  };

  const handleDeleteQuestion = (index: number) => {
    dispatch({ type: 'deleteQuestion', index });
  };

  const handleSubmit = async () => {
    if (!state.selectedCategory) {
      toast.error('Vui lòng chọn danh mục');
      return;
    }

    if (state.questions.length === 0) {
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
          title: state.title,
          categoryId: state.selectedCategory._id,
          description: state.description,
          questions: state.questions,
          pdfUrl,
          isPrivate: state.isPrivate,
        }),
      });

      // Remove from store
      removeDraft(initialDraft._id);

      toast.success('Quiz đã được gửi để duyệt!');
      push(`/${locale}/quiz/${data.slug}`);
    } catch (error: unknown) {
      toast.error('Lỗi', { description: extractUnknownErrorMessage(error, 'Không thể gửi quiz') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex min-h-screen items-center justify-center px-4 py-6 text-center md:hidden">
        <div>
          <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-green-100 mx-auto">
            <HiOutlineDesktopComputer className="size-10 text-brand-trust" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-neutral-900">Mở trên máy tính</h1>
          <p className="mx-auto mb-6 max-w-xs text-neutral-500">
            Để chỉnh sửa chi tiết câu hỏi, vui lòng sử dụng máy tính.
          </p>
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-trust"
          >
            <HiOutlineArrowLeft className="size-5" />
            Về trang chủ
          </Link>
        </div>
      </div>

      <div className="hidden md:flex">
        {/* Left Side - Form Content */}
        <div
          className={`transition-[width] duration-300 ${state.showPDFViewer && pdfUrl ? 'w-1/2' : 'w-full'}`}
        >
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <Link
                href={`/${locale}`}
                className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 mb-4"
              >
                <HiOutlineArrowLeft className="size-4" />
                Quay lại
              </Link>
              <h1 className="text-2xl font-semibold text-neutral-900">Chỉnh sửa Quiz</h1>
              <p className="text-neutral-500 mt-1 flex items-center gap-2">
                <HiOutlineQuestionMarkCircle className="size-4" />
                {state.questions.length} câu hỏi được trích xuất
              </p>
            </div>

            {/* Basic Info using shared generic QuizMetaForm */}
            <QuizMetaForm
              title={state.title}
              onTitleChange={(value) => dispatch({ type: 'setTitle', value })}
              description={state.description}
              onDescriptionChange={(value) => dispatch({ type: 'setDescription', value })}
              selectedCategory={state.selectedCategory}
              onCategoryChange={(value) => dispatch({ type: 'setSelectedCategory', value })}
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
              isPrivate={state.isPrivate}
              onPrivateChange={(value) => dispatch({ type: 'setIsPrivate', value })}
              disabled={isSubmitting}
            />

            {/* Questions */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <HiOutlineCollection className="size-5 text-brand-trust" />
                Câu hỏi ({state.questions.length})
              </h2>

              <div className="space-y-4">
                {state.questions.map((q, index) => (
                  <QuestionEditor
                    key={`${q.question}-${q.options.join('|')}`}
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
                  onClick={() =>
                    dispatch({ type: 'setShowPDFViewer', value: !state.showPDFViewer })
                  }
                  variant="outline"
                  className="flex items-center gap-2 text-brand-trust border-green-200 hover:bg-green-50"
                >
                  {state.showPDFViewer ? (
                    <>
                      <HiOutlineEyeOff className="size-4" /> Ẩn PDF
                    </>
                  ) : (
                    <>
                      <HiOutlineDocumentText className="size-4" /> Xem PDF
                    </>
                  )}
                </Button>
              )}
              <div className="flex gap-3 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => push(`/${locale}`)}
                  className="flex items-center gap-2 px-6 py-3 text-neutral-700 hover:bg-neutral-50"
                >
                  <HiOutlineX className="size-4" />
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !state.selectedCategory || state.questions.length === 0}
                  className="flex items-center gap-2 px-6 py-3"
                >
                  {isSubmitting ? (
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HiOutlineCloudUpload className="size-5" />
                  )}
                  {isSubmitting ? 'Đang gửi…' : 'Gửi để duyệt'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - PDF Viewer */}
        {state.showPDFViewer && pdfUrl && (
          <div className="w-1/2 h-screen sticky top-0 p-4 bg-white border-l border-neutral-200">
            <PDFViewer
              pdfDataUrl={pdfDataUrl || null}
              pdfUrl={pdfUrl}
              onClose={() => dispatch({ type: 'setShowPDFViewer', value: false })}
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
  const [editedQuestion, setEditedQuestion] = useState('');

  const handleStartEdit = () => {
    setEditedQuestion(question.question);
    setIsEditing(true);
  };

  const handleSave = () => {
    onEdit({ question: editedQuestion });
    setIsEditing(false);
  };

  return (
    <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <span className="text-xs font-medium text-neutral-500 uppercase flex items-center gap-1.5">
            <div className="size-5 bg-green-100 text-brand-trust rounded-full flex items-center justify-center text-[10px]">
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
                <HiOutlineCheck className="size-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(false)}
                className="text-neutral-400 hover:bg-neutral-100"
              >
                <HiOutlineX className="size-5" />
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
              onClick={handleStartEdit}
              className="text-brand-trust/70 hover:bg-green-50 hover:text-brand-trust"
            >
              <HiOutlinePencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-red-500/80 hover:bg-red-50 hover:text-red-600"
            >
              <HiOutlineTrash className="size-4" />
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
              key={`${optIdx}-${opt}`}
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
