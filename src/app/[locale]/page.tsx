'use client';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { GuestLanding, DashboardClient } from './_components';
import { useQuizzes } from '@/hooks';
import { NavLogo } from '@/components/Navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const t = useTranslations('common');

  // Guest view - Render immediately without hooks that trigger API calls
  if (status !== 'loading' && !session) {
    const hustMockQuizzes = [
      {
        _id: 'mock-1',
        title: 'Giải tích 1 (MI1111)',
        description: 'Tổng hợp các dạng bài tập đạo hàm, nguyên hàm và ứng dụng cho sinh viên Bách Khoa.',
        slug: 'giai-tich-1-hust',
        category: { name: 'Toán học', color: 'blue' }
      },
      {
        _id: 'mock-2',
        title: 'Vật lý đại cương 1 (PH1110)',
        description: 'Câu hỏi trắc nghiệm chương Cơ - Nhiệt, bám sát nội dung đề thi giữa kỳ và cuối kỳ HUST.',
        slug: 'vat-ly-1-hust',
        category: { name: 'Khoa học', color: 'purple' }
      },
      {
        _id: 'mock-3',
        title: 'Lập trình C cơ bản (IT1110)',
        description: 'Hệ thống câu hỏi về kiểu dữ liệu, vòng lặp, mảng và con trỏ trong ngôn ngữ C.',
        slug: 'lap-trinh-c-hust',
        category: { name: 'CNTT', color: 'green' }
      },
      {
        _id: 'mock-4',
        title: 'Triết học Mác - Lênin (SSH1110)',
        description: 'Bộ đề ôn tập trắc nghiệm lý luận chính trị dành cho sinh viên năm nhất.',
        slug: 'triet-hoc-hust',
        category: { name: 'Chính trị', color: 'red' }
      },
      {
        _id: 'mock-5',
        title: 'Tiếng Anh cơ bản (FL1100)',
        description: 'Luyện tập các kỹ năng Listening và Reading theo định dạng bài thi của HUST.',
        slug: 'tieng-anh-hust',
        category: { name: 'Ngoại ngữ', color: 'orange' }
      },
      {
        _id: 'mock-6',
        title: 'Cấu trúc dữ liệu & Giải thuật (IT3011)',
        description: 'Nâng cao tư duy lập trình với các thuật toán sắp xếp, tìm kiếm và cấu trúc cây phức tạp.',
        slug: 'ctdl-gt-hust',
        category: { name: 'CNTT', color: 'indigo' }
      }
    ];
    return <GuestLanding quizzes={hustMockQuizzes} />;
  }

  // Use hooks only for authenticated users or while loading
  return <AuthenticatedHomePage session={session} status={status} />;
}

function AuthenticatedHomePage({ session, status }: { session: any, status: string }) {
  const { quizzes, isLoading: quizzesLoading } = useQuizzes(6);
  const t = useTranslations('common');

  if (status === 'loading' || quizzesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-center animate-pulse">
          <div className="flex justify-center mb-4">
            <NavLogo />
          </div>
          <p className="text-[#86868b]">{t('loadingDashboard')}</p>
        </div>
      </div>
    );
  }

  return <DashboardClient userEmail={session?.user?.email || ''} />;
}
