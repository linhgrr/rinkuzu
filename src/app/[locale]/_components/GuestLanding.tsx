import type { CSSProperties } from 'react';
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
    <div
      className="min-h-screen bg-black"
      style={
        {
          '--hero-heading-gradient': 'linear-gradient(144.5deg, #ffffff 28%, rgba(0, 0, 0, 0) 115%)',
        } as CSSProperties
      }
    >
      <main>
        <HeroSection />
      </main>
    </div>
  );
}
