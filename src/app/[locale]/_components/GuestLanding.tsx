'use client';

import { HeroSection } from './new-landing';

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

export function GuestLanding({ quizzes }: GuestLandingProps) {
  return (
    <div className="min-h-screen bg-black">
      <main>
        <HeroSection />
      </main>
    </div>
  );
}
