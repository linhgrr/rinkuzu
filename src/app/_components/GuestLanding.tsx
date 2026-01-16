'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/shared/constants';
import { HiOutlineArrowRight } from 'react-icons/hi';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    name: string;
    color: string;
  };
}

interface GuestLandingProps {
  quizzes: Quiz[];
}

const CategoryBadgeVariant = (color: string) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'default'> = {
    'bg-blue-100': 'info',
    'bg-green-100': 'success',
    'bg-yellow-100': 'warning',
    'bg-red-100': 'danger',
    'bg-purple-100': 'purple',
  };
  return map[color] || 'default';
};

export function GuestLanding({ quizzes }: GuestLandingProps) {
  const router = useRouter();

  const handleGetStarted = useCallback(() => {
    router.push(ROUTES.REGISTER);
  }, [router]);

  const handleLogin = useCallback(() => {
    router.push(ROUTES.LOGIN);
  }, [router]);

  const handleExplore = useCallback(() => {
    router.push(ROUTES.EXPLORE);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-semibold mb-6 tracking-tight">
          Master any subject.
        </h1>
        <p className="text-xl text-[#86868b] mb-12 max-w-2xl mx-auto">
          Create AI-powered quizzes from your study materials. Track progress
          with Spaced Repetition.
        </p>
        <div className="flex justify-center gap-4 mb-20">
          <Button size="lg" onClick={handleGetStarted}>
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" onClick={handleLogin}>
            Log In
          </Button>
        </div>

        {/* Public Quizzes Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-12">
          {quizzes.slice(0, 3).map((quiz) => (
            <Card key={quiz._id} className="p-6">
              <Badge
                className="mb-2"
                variant={CategoryBadgeVariant(quiz.category?.color)}
              >
                {quiz.category?.name}
              </Badge>
              <h3 className="font-semibold text-lg mb-2">{quiz.title}</h3>
              <p className="text-sm text-[#86868b] line-clamp-2">
                {quiz.description}
              </p>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={handleExplore}>
            Explore All Quizzes <HiOutlineArrowRight className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
