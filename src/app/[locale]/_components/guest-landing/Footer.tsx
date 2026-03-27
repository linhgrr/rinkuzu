'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { HiOutlineMail } from '@/components/icons'
import { NavLogo } from '@/components/Navigation/NavLogo'

export function Footer() {
  const t = useTranslations('landing.footer')

  return (
    <footer className="bg-white pt-24 pb-12 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          {/* Logo & Contact */}
          <div className="space-y-6">
            <NavLogo />
            <div className="space-y-4 text-gray-500 text-sm">
              <div className="flex items-center gap-3">
                <HiOutlineMail className="w-5 h-5 text-teal-600 shrink-0" aria-hidden="true" />
                <a href="mailto:support@rinkuzu.com" className="hover:text-teal-600 transition-colors">support@rinkuzu.com</a>
              </div>
              <div className="flex items-start gap-3">
                {/* Address icon */}
                <svg className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="leading-relaxed">Room 302, Building A1<br />Hanoi University of Science &amp; Technology<br />Hai Ba Trung, Hanoi, Vietnam</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-[#1e242c] mb-6 uppercase tracking-wider text-sm">{t('links.title')}</h4>
            <ul className="space-y-4">
              <li><Link href="/" className="text-gray-500 hover:text-teal-600 transition-colors">{t('links.home')}</Link></li>
              <li><Link href="/about" className="text-gray-500 hover:text-teal-600 transition-colors">{t('links.about')}</Link></li>
              <li><Link href="/pricing" className="text-gray-500 hover:text-teal-600 transition-colors">{t('links.pricing')}</Link></li>
              <li><Link href="/faq" className="text-gray-500 hover:text-teal-600 transition-colors">{t('links.faq')}</Link></li>
              <li><Link href="/contact" className="text-gray-500 hover:text-teal-600 transition-colors">Contact</Link></li>
              <li><Link href="/blog" className="text-gray-500 hover:text-teal-600 transition-colors">{t('links.blog')}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-[#1e242c] mb-6 uppercase tracking-wider text-sm">{t('legal.title')}</h4>
            <ul className="space-y-4">
              <li><Link href="/privacy" className="text-gray-500 hover:text-teal-600 transition-colors">{t('legal.privacy')}</Link></li>
              <li><Link href="/terms" className="text-gray-500 hover:text-teal-600 transition-colors">{t('legal.terms')}</Link></li>
              <li><Link href="/cookies" className="text-gray-500 hover:text-teal-600 transition-colors">{t('legal.cookie')}</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-6">
            <h4 className="font-bold text-[#1e242c] uppercase tracking-wider text-sm">{t('newsletter.title')}</h4>
            <p className="text-gray-600 text-sm">{t('newsletter.description')}</p>
            <div className="relative">
              <input
                type="email"
                name="newsletter-email"
                placeholder={`${t('newsletter.placeholder')}…`}
                aria-label={t('newsletter.placeholder')}
                autoComplete="email"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm text-gray-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
              />
              <button className="absolute right-2 top-2 bottom-2 bg-teal-600 text-white px-4 rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                {t('newsletter.button')}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-gray-600 text-sm">
            {t('copyright')}
          </p>
          {/*
          Social links placeholder — add real brand accounts when available:
          {[
            { name: 'Twitter', url: 'https://twitter.com/rinkuzu' },
            { name: 'Facebook', url: 'https://facebook.com/rinkuzu' },
            { name: 'LinkedIn', url: 'https://linkedin.com/company/rinkuzu' },
            { name: 'Instagram', url: 'https://instagram.com/rinkuzu' }
          ].map((social) => (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-[#1e242c] transition-colors text-sm focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:rounded"
            >
              {social.name}
            </a>
          ))}
          */}
        </div>
      </div>
    </footer>
  )
}
