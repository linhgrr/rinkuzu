'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  const t = useTranslations('landing.footer');

  return (
    <footer className="bg-[#0d0d0d] border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <div>
              <Image
                src="/images/navbar_logo.webp"
                alt="RinKuzu Logo"
                width={120}
                height={32}
                className="h-8 w-auto object-contain brightness-0 invert"
              />
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              AI-powered adaptive learning platform. Transform any PDF into a personalized quiz journey with knowledge graphs and Bloom&apos;s Taxonomy.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              {t('links.title')}
            </h4>
            <ul className="space-y-3">
              {[
                { label: t('links.home'), href: '/' },
                { label: t('links.about'), href: '/about' },
                { label: t('links.pricing'), href: '/pricing' },
                { label: t('links.faq'), href: '/faq' },
                { label: t('links.blog'), href: '/blog' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/50 text-sm hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              {t('legal.title')}
            </h4>
            <ul className="space-y-3">
              {[
                { label: t('legal.privacy'), href: '/privacy' },
                { label: t('legal.terms'), href: '/terms' },
                { label: t('legal.cookie'), href: '/cookies' },
                { label: t('contact'), href: '/contact' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/50 text-sm hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider">
              {t('newsletter.title')}
            </h4>
            <p className="text-white/50 text-sm">{t('newsletter.description')}</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder={t('newsletter.placeholder')}
                aria-label={t('newsletter.placeholder')}
                autoComplete="email"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50 transition-colors"
              />
              <button className="bg-teal-500 text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-teal-400 transition-colors whitespace-nowrap">
                {t('newsletter.button')}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">
            {t('copyright')}
          </p>
          <p className="text-white/30 text-sm">
            support@rinkuzu.com
          </p>
        </div>
      </div>
    </footer>
  );
}
