import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { defaultLocale } from '@/i18n/config';
import { GuestLanding } from '@/app/[locale]/_components';
import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return buildLocalizedMetadata({
    locale,
    path: '/',
    title: isVi
      ? 'Tạo Quiz AI từ PDF - Đồ thị Kiến thức | RinKuzu'
      : 'AI Quiz Generator from PDF - Knowledge Graph | RinKuzu',
    description: isVi
      ? 'Tạo quiz từ PDF bằng AI, học theo đồ thị kiến thức và luyện tập thích ứng cho học sinh, sinh viên và giáo viên.'
      : 'Generate quizzes from PDFs with AI, build knowledge graph learning paths, and run adaptive practice sessions for students and teachers.',
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
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
      title: 'Calculus 1 (MI1111)',
      description:
        'A comprehensive set of derivative, integral, and application problems for university students.',
      slug: 'giai-tich-1-hust',
      category: { name: 'Mathematics', color: 'blue' },
    },
    {
      _id: 'mock-2',
      title: 'General Physics 1 (PH1110)',
      description:
        'Multiple-choice questions on Mechanics and Thermodynamics aligned with midterm and final exam formats.',
      slug: 'vat-ly-1-hust',
      category: { name: 'Science', color: 'green' },
    },
    {
      _id: 'mock-3',
      title: 'Introduction to C Programming (IT1110)',
      description:
        'Practice questions on data types, loops, arrays, and pointers in the C language.',
      slug: 'lap-trinh-c-hust',
      category: { name: 'Computer Science', color: 'green' },
    },
    {
      _id: 'mock-4',
      title: 'Marxism-Leninism Philosophy (SSH1110)',
      description: 'Political theory review quizzes designed for first-year university students.',
      slug: 'triet-hoc-hust',
      category: { name: 'Politics', color: 'red' },
    },
    {
      _id: 'mock-5',
      title: 'Basic English (FL1100)',
      description: 'Listening and Reading practice following common university exam formats.',
      slug: 'tieng-anh-hust',
      category: { name: 'Languages', color: 'orange' },
    },
    {
      _id: 'mock-6',
      title: 'Data Structures & Algorithms (IT3011)',
      description:
        'Strengthen problem-solving with sorting, searching, and advanced tree-based structures.',
      slug: 'ctdl-gt-hust',
      category: { name: 'Computer Science', color: 'teal' },
    },
  ];

  return <GuestLanding quizzes={hustMockQuizzes} isAuthenticated={Boolean(session?.user)} />;
}
