'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function Footer() {
  const t = useTranslations('landing.footer');

  return (
    <footer
      className="bg-neutral-900 border-t border-white/10"
      style={{ backgroundColor: '#181815' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/images/navbar_logo.webp"
                alt="RinKuzu Logo"
                width={160}
                height={40}
                className="h-10 w-auto object-contain"
                priority={false}
              />
            </Link>
            <p className="text-white/50 text-sm leading-relaxed">
              AI-powered adaptive learning platform. Transform any PDF into a personalized quiz
              journey.
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
                  <Link
                    href={link.href}
                    className="text-white/50 text-sm transition-colors hover:text-[var(--brand-action)] focus-visible:text-[var(--brand-action)]"
                  >
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
                  <Link
                    href={link.href}
                    className="text-white/50 text-sm transition-colors hover:text-[var(--brand-action)] focus-visible:text-[var(--brand-action)]"
                  >
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
              <Input
                type="email"
                placeholder={t('newsletter.placeholder')}
                aria-label={t('newsletter.placeholder')}
                autoComplete="email"
                className="flex-1 rounded-lg border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus-visible:border-brand-trust/50"
              />
              <Button
                type="button"
                className="whitespace-nowrap rounded-lg bg-brand-trust px-4 py-2 text-sm font-bold text-white hover:bg-brand-trust-hover"
              >
                {t('newsletter.button')}
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">{t('copyright')}</p>
          <p className="text-white/30 text-sm">support@rinkuzu.com</p>
        </div>
      </div>
    </footer>
  );
}
