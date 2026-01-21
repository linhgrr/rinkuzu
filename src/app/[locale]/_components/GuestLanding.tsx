'use client';

import Navigation from '@/components/Navigation';
import {
  Hero,
  PopularCategories,
  Features,
  HowItWorks,
  Testimonials,
  FAQ,
  CTA,
  Footer
} from './guest-landing';

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
    <div className="min-h-screen bg-white">
      <Navigation transparent />
      <main>
        <Hero />
        <PopularCategories quizzes={quizzes} />
        <Features />
        <HowItWorks />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
