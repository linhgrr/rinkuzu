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
      className="border-t"
      style={{
        backgroundColor: '#181815',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        color: '#D4D4CF',
      }}
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
            <p className="text-[15px] font-normal leading-7 text-[#BFC0B7]">{t('description')}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-[#F3F4EF]">
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
                    className="rounded-sm text-sm font-medium leading-6 text-[#D6D7CF] visited:text-[#D6D7CF] transition-colors hover:text-brand-action focus-visible:text-brand-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action visited:hover:text-brand-action"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-[#F3F4EF]">
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
                    className="rounded-sm text-sm font-medium leading-6 text-[#D6D7CF] visited:text-[#D6D7CF] transition-colors hover:text-brand-action focus-visible:text-brand-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action visited:hover:text-brand-action"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-[#F3F4EF]">
              {t('newsletter.title')}
            </h4>
            <p className="text-sm leading-6 text-[#BFC0B7]">{t('newsletter.description')}</p>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder={t('newsletter.placeholder')}
                aria-label={t('newsletter.placeholder')}
                autoComplete="email"
                className="h-10 flex-1 rounded-lg border-white/10 bg-[#F9FAF6] px-4 text-sm text-[#1E1F1B] placeholder:text-[#717368] focus-visible:border-brand-trust/50"
              />
              <Button
                type="button"
                className="h-10 whitespace-nowrap rounded-lg bg-[#00A895] px-4 text-sm font-semibold text-white hover:bg-[#009684]"
              >
                {t('newsletter.button')}
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-7 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#A9AAA2]">{t('copyright')}</p>
          <p className="text-sm font-medium text-[#A9AAA2]">support@rinkuzu.com</p>
        </div>
      </div>
    </footer>
  );
}
