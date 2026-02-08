'use client'

import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { HiOutlineCode, HiOutlineTranslate, HiOutlineCalculator, HiOutlineBeaker, HiOutlineAcademicCap, HiOutlineLightningBolt, HiOutlineArrowRight } from '@/components/icons'

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

interface PopularCategoriesProps {
  quizzes: Quiz[];
}

export function PopularCategories({ quizzes }: PopularCategoriesProps) {
  const t = useTranslations('landing.categories')

  const categories = [
    { id: 'dev', name: t('items.dev'), icon: HiOutlineCode, count: 124, active: false },
    { id: 'lang', name: t('items.lang'), icon: HiOutlineTranslate, count: 86, active: true },
    { id: 'math', name: t('items.math'), icon: HiOutlineCalculator, count: 52, active: false },
    { id: 'science', name: t('items.science'), icon: HiOutlineBeaker, count: 43, active: false },
    { id: 'history', name: t('items.history'), icon: HiOutlineAcademicCap, count: 31, active: false },
    { id: 'design', name: t('items.design'), icon: HiOutlineLightningBolt, count: 28, active: false },
  ]

  return (
    <section className="py-16 md:py-20 bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-[#1e242c] mb-4">
            {t('title')}
          </h2>
          <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto pb-4 mb-12 no-scrollbar gap-2 sm:justify-center">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`flex items-center gap-2 px-6 py-3 rounded-full whitespace-nowrap transition-all border focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${cat.active
                  ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm'
                  : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                }`}
            >
              <cat.icon className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Quiz Grid Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {quizzes.slice(0, 4).map((quiz) => (
            <Card key={quiz._id} className="p-6 hover:shadow-apple-lg transition-shadow border-none">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase">
                  {quiz.title.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-gray-900 truncate">{quiz.title}</h4>
                  <p className="text-xs text-gray-400">4.8 (12 reviews)</p>
                </div>
              </div>
              <h3 className="font-semibold text-gray-700 text-sm mb-2 line-clamp-2">{quiz.description || "No description"}</h3>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="px-3 py-1 bg-gray-50 rounded-full text-[10px] text-gray-500 font-medium uppercase tracking-wider border border-gray-100">
                  {quiz.category?.name || 'General'}
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* View All Button */}
        <div className="flex justify-center">
          <Link
            href="/explore"
            className="inline-flex items-center rounded-full px-8 py-6 text-base font-bold border-2 border-blue-200 text-blue-600 hover:bg-blue-50 transition-all group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {t('viewAll')}
            <HiOutlineArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
