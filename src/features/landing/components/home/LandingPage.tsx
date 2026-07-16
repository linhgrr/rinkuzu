import { Unbounded, Vina_Sans } from 'next/font/google';

import Header from './Header';
import Hero from './Hero';
import Metrics from './Metrics';
import StruggleSection from './StruggleSection';
import HowItWorks from './HowItWorks';
import CoreIntelligence from './CoreIntelligence';
import Testimonials from './Testimonials';
import BottomCta from './BottomCta';
import Footer from './Footer';
import TextureBackground from './TextureBackground';

const unbounded = Unbounded({
  subsets: ['latin'],
  display: 'optional',
  variable: '--font-unbounded',
});

const vinaSans = Vina_Sans({
  subsets: ['latin'],
  display: 'optional',
  preload: false,
  variable: '--font-vina-sans',
  weight: ['400'],
});

const MARQUEE_ITEMS = ['AI POWERED', 'STUDY FLOW', 'LEARNING PATH', 'DIGITAL BRAIN'] as const;

interface LandingPageProps {
  locale: string;
  isAuthenticated?: boolean;
}

export default function LandingPage({ locale, isAuthenticated = false }: LandingPageProps) {
  return (
    <div
      className={`${unbounded.variable} ${vinaSans.variable} relative w-full overflow-clip bg-[#06090e] min-h-screen text-white font-unbounded`}
    >
      <TextureBackground />
      <Header locale={locale} isAuthenticated={isAuthenticated} />

      <main className="relative z-10 w-full max-w-[1920px] mx-auto px-4 sm:px-8 md:px-12 lg:px-[96px]">
        {/* Hero */}
        <section className="relative w-full flex flex-col">
          <Hero locale={locale} isAuthenticated={isAuthenticated} />
        </section>

        {/* Metrics — overlaps hero */}
        <section className="relative z-20 w-full py-12 md:py-24 xl:-mt-[206px]">
          <Metrics />
        </section>

        {/* Struggle */}
        <section className="landing-deferred-section landing-deferred-section--tall relative w-full pt-[80px] md:pt-[154px] pb-[40px] md:pb-[44px] z-20">
          <StruggleSection />
        </section>

        {/* Marquee */}
        <div className="landing-deferred-section w-[100vw] overflow-hidden relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] bg-accent mt-[68px] md:mt-[215px] mb-0">
          <div className="landing-marquee-track flex h-[80px] w-max items-center whitespace-nowrap text-[20px] font-unbounded font-normal text-[#06090e]">
            {[false, true].map((duplicate) => (
              <div
                key={String(duplicate)}
                className="flex shrink-0 items-center gap-[72px] pr-[72px]"
                aria-hidden={duplicate || undefined}
              >
                {MARQUEE_ITEMS.map((item) => (
                  <p key={item} className="shrink-0">
                    {item}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <section className="landing-deferred-section landing-deferred-section--tall relative w-full pt-[120px] md:pt-[232px] pb-0 z-20">
          <HowItWorks />
        </section>

        {/* Core Intelligence */}
        <section className="landing-deferred-section landing-deferred-section--tall relative w-full pt-[60px] md:pt-[167px] pb-0 z-20">
          <CoreIntelligence />
        </section>

        {/* Testimonials */}
        <section className="landing-deferred-section landing-deferred-section--tall relative w-full pt-[40px] md:pt-[132px] pb-0 z-20">
          <Testimonials />
        </section>

        {/* Bottom CTA — full viewport width */}
        <div className="landing-deferred-section w-[100vw] relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mt-[40px] md:mt-[92px] z-20">
          <BottomCta locale={locale} isAuthenticated={isAuthenticated} />
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
