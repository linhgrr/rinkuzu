import type { Metadata } from 'next';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/contact',
    title: 'Contact Us | RinKuzu',
    description:
      'Get in touch with the RinKuzu team. Contact us for support, partnership inquiries, educator discounts, or technical questions.',
  });
}

export default async function ContactPage({ params }: Props) {
  await params;

  return (
    <section className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[var(--bg-section)] border-b border-neutral-100 py-20 md:py-28">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-5xl font-semibold text-[var(--text-primary)] mb-4">
            Get in Touch
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed">
            Have questions about RinKuzu? Need help with your account? Interested in educator or
            institutional pricing? We&apos;d love to hear from you.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Methods */}
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">MAIL</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">Email Support</h2>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  Best for: technical questions, bug reports, account issues
                </p>
                <a
                  href="mailto:support@rinkuzu.app"
                  className="text-brand-trust font-medium hover:text-brand-trust-hover hover:underline"
                >
                  support@rinkuzu.app
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">AI</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">AI Tutor Rin-chan</h2>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  Available 24/7 on the platform for instant answers to common questions
                </p>
                <Link
                  href="/register"
                  className="text-brand-trust font-medium hover:text-brand-trust-hover hover:underline"
                >
                  Try Rin-chan →
                </Link>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">EDU</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">
                  Educator & Institutional Pricing
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  Universities, schools, and corporate training programs, contact us for custom
                  pricing and pilot programs.
                </p>
                <a
                  href="mailto:support@rinkuzu.app?subject=Educator%20Pricing%20Inquiry"
                  className="text-brand-trust font-medium hover:text-brand-trust-hover hover:underline"
                >
                  Email our team →
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">HQ</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">Mailing Address</h2>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  Room 302, Building A1
                  <br />
                  Hanoi University of Science and Technology
                  <br />
                  17 Dai Co Viet Street
                  <br />
                  Hai Ba Trung District
                  <br />
                  Hanoi, Vietnam
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">BUG</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">Bug Reports</h2>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  Found something that doesn&apos;t work as expected? Email us with steps to
                  reproduce and we&apos;ll investigate.
                </p>
                <a
                  href="mailto:support@rinkuzu.app?subject=Bug%20Report"
                  className="text-brand-trust font-medium hover:text-brand-trust-hover hover:underline"
                >
                  Report a bug →
                </a>
              </div>
            </div>
          </div>

          {/* Response Time & FAQ */}
          <div className="space-y-6">
            <div className="bg-[var(--bg-section)] rounded-2xl p-6 border border-neutral-100">
              <h2 className="font-semibold text-[var(--text-primary)] mb-4">Response Times</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-[var(--text-muted)]">Email support</span>
                  <span className="font-medium text-[var(--text-primary)]">Within 24–48 hours</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-[var(--text-muted)]">Educator inquiries</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    Within 3 business days
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-[var(--text-muted)]">Bug reports</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    Within 5 business days
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--text-muted)]">Rin-chan (AI tutor)</span>
                  <span className="font-medium text-[var(--text-primary)]">24/7, instant</span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-section)] rounded-2xl p-6 border border-neutral-100">
              <h2 className="font-semibold text-[var(--text-primary)] mb-4">
                Before You Contact Us
              </h2>
              <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
                Many common questions are answered in our FAQ and documentation. Check these first:
              </p>
              <div className="space-y-3">
                <Link
                  href="/faq"
                  className="group flex items-center justify-between rounded-xl border border-neutral-200 p-3 transition-colors hover:border-green-200 hover:bg-green-50/30"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    FAQ: Frequently Asked Questions
                  </span>
                  <span className="text-neutral-400 group-hover:text-brand-trust transition-colors">
                    →
                  </span>
                </Link>
                <Link
                  href="/about"
                  className="group flex items-center justify-between rounded-xl border border-neutral-200 p-3 transition-colors hover:border-green-200 hover:bg-green-50/30"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    About RinKuzu: Our Story & Research
                  </span>
                  <span className="text-neutral-400 group-hover:text-brand-trust transition-colors">
                    →
                  </span>
                </Link>
                <Link
                  href="/pricing"
                  className="group flex items-center justify-between rounded-xl border border-neutral-200 p-3 transition-colors hover:border-green-200 hover:bg-green-50/30"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Pricing: Free vs. Premium
                  </span>
                  <span className="text-neutral-400 group-hover:text-brand-trust transition-colors">
                    →
                  </span>
                </Link>
              </div>
            </div>

            {/* Community CTA */}
            <div className="bg-gradient-to-br from-[var(--text-primary)] to-[#2d2d2f] rounded-2xl p-6 text-white">
              <h2 className="font-semibold mb-2">Join 50,000+ learners on RinKuzu</h2>
              <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
                Upload your first PDF and experience AI-powered adaptive learning, free, no credit
                card required.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-brand-action px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-action-hover"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
