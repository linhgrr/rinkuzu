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
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:grid-cols-4 lg:gap-14 mb-14 md:mb-16">
          {/* Brand */}
          <div className="space-y-5">
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
            <p className="text-[15px] font-normal leading-7 text-white/70">
              AI-powered adaptive learning platform. Transform any PDF into a personalized quiz
              journey.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-white/90">
              {t('links.title')}
            </h4>
            <ul className="space-y-3.5">
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
                    className="text-sm font-medium leading-6 text-white/80 transition-colors hover:text-white focus-visible:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-white/90">
              {t('legal.title')}
            </h4>
            <ul className="space-y-3.5">
              {[
                { label: t('legal.privacy'), href: '/privacy' },
                { label: t('legal.terms'), href: '/terms' },
                { label: t('legal.cookie'), href: '/cookies' },
                { label: t('contact'), href: '/contact' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium leading-6 text-white/80 transition-colors hover:text-white focus-visible:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-4.5">
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-white/90">
              {t('newsletter.title')}
            </h4>
            <p className="text-sm leading-6 text-white/70">{t('newsletter.description')}</p>
            <div className="flex gap-2.5">
              <Input
                type="email"
                placeholder={t('newsletter.placeholder')}
                aria-label={t('newsletter.placeholder')}
                autoComplete="email"
                className="h-10 flex-1 rounded-lg border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 focus-visible:border-brand-trust/50"
              />
              <Button
                type="button"
                className="h-10 whitespace-nowrap rounded-lg bg-brand-trust px-4 text-sm font-semibold text-white hover:bg-brand-trust-hover"
              >
                {t('newsletter.button')}
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-7 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm font-medium text-white/60">{t('copyright')}</p>
          <p className="text-sm font-medium text-white/60">support@rinkuzu.com</p>
        </div>
      </div>
    </footer>
  );
}
