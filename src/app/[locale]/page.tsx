import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { defaultLocale } from '@/i18n/config';
import { GuestLanding } from './_components';
import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return buildLocalizedMetadata({
    locale,
    path: '/',
    title: 'RinKuzu - Tao quiz tu PDF bang AI',
    description:
      'Nen tang tao va luyen tap quiz thong minh tu PDF voi AI, ho tro giao vien va sinh vien hoc tap hieu qua.',
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const dashboardPath = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
    redirect(dashboardPath);
  }

  // Guest view - Render immediately on server
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
