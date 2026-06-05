import HeroSection from './new-landing/HeroSection';
import { Features as FeatureSection } from './new-landing/Features';
import { HowItWorks as HowItWorksSection } from './new-landing/HowItWorks';
import { FeaturedQuizzes } from './new-landing/FeaturedQuizzes';
import { FAQ as FaqSection } from './new-landing/FAQ';
import { FinalCTA } from './new-landing/FinalCTA';

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
  isAuthenticated?: boolean;
}

export function GuestLanding({ quizzes, isAuthenticated = false }: GuestLandingProps) {
  return (
    <div className="min-h-screen bg-[#07121a]">
      <main>
        <HeroSection isAuthenticated={isAuthenticated} />
        <FeatureSection />
        <HowItWorksSection />
        <FeaturedQuizzes quizzes={quizzes} />
        <FaqSection />
        <FinalCTA />
      </main>
    </div>
  );
}
