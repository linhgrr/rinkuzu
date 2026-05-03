'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui/Card';
import Navigation from '@/components/Navigation';
import { ROUTES } from '@/shared/constants';
import {
  HiOutlineSearch,
  HiOutlineExclamationCircle,
  HiOutlineInbox,
  HiOutlineArrowRight,
} from '@/components/icons';

interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
  quizCount: number;
  slug: string;
}

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories');
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch categories');
        return;
      }

      setCategories(data.data);
      setFilteredCategories(data.data);
      setError('');
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('An error occurred while fetching categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = categories.filter(
        (category) =>
          category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.description.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(categories);
    }
  }, [searchTerm, categories]);

  const getCategoryColor = (color: string) => {
    const colorMap: { [key: string]: string } = {
      blue: 'bg-green-50 text-brand-trust border-green-100',
      green: 'bg-green-100 text-green-700 border-green-200',
      purple: 'bg-green-100 text-green-700 border-green-200',
      red: 'bg-red-50 text-red-700 border-red-100',
      yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
      indigo: 'bg-green-50 text-brand-trust border-green-100',
      pink: 'bg-pink-50 text-pink-700 border-pink-100',
      gray: 'bg-neutral-100 text-neutral-700 border-neutral-200',
      cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
      orange: 'bg-orange-50 text-orange-700 border-orange-100',
      teal: 'bg-green-100 text-brand-trust-hover border-green-200',
    };
    return colorMap[color?.toLowerCase()] || colorMap['green'];
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <div className="flex justify-center items-center h-64">
            <div className="h-16 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Image
                src="/images/auth_logo.png"
                alt="RinKuzu Logo"
                width={64}
                height={64}
                className="h-16 w-auto object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <Card variant="bordered" className="p-6 mb-8 border-red-200 bg-red-50">
            <div className="flex items-center text-red-700">
              <HiOutlineExclamationCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 md:pt-20 pb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-neutral-500 mb-4 md:mb-6">
          <Link href={ROUTES.DASHBOARD} className="hover:text-neutral-700">
            {tNav('home')}
          </Link>
          <span>›</span>
          <span className="text-neutral-900 font-medium">{t('title')}</span>
        </nav>

        {/* Search */}
        <div className="mb-8 md:mb-12">
          <Card variant="default" className="p-4 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder={tCommon('search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<HiOutlineSearch className="w-5 h-5" />}
                  className="w-full"
                />
              </div>
              {searchTerm && (
                <Button
                  variant="ghost"
                  onClick={() => setSearchTerm('')}
                  className="text-brand-trust hover:text-brand-trust-hover w-full sm:w-auto"
                >
                  {tCommon('cancel')}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <p className="text-sm md:text-base text-neutral-600">
            Showing {filteredCategories.length} of {categories.length} categories
            {searchTerm && (
              <span className="ml-2">
                matching &quot;<strong>{searchTerm}</strong>&quot;
              </span>
            )}
          </p>
        </div>

        {/* Categories Grid */}
        {filteredCategories.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <HiOutlineInbox className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-3">{t('title')}</h3>
            <p className="text-neutral-600 mb-6">
              {searchTerm
                ? 'Try adjusting your search criteria or browse all categories.'
                : 'No categories available yet.'}
            </p>
            {searchTerm && (
              <Button variant="primary" onClick={() => setSearchTerm('')} className="mx-auto">
                View All {t('title')}
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {filteredCategories.map((category, index) => (
              <Card
                key={category._id}
                variant="default"
                hover
                className="group animate-fadeInUp"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="success" size="sm" className={getCategoryColor(category.color)}>
                      {t('title')}
                    </Badge>
                    <span className="text-xs font-medium text-neutral-500">
                      {t('quizCount', { count: category.quizCount })}
                    </span>
                  </div>
                  <CardTitle
                    size="md"
                    className="line-clamp-2 text-neutral-900 group-hover:text-brand-trust"
                  >
                    {category.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 mt-2">
                    {category.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 border-t border-neutral-100">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-600">
                      {t('quizCount', { count: category.quizCount })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/category/${category.slug}`);
                      }}
                    >
                      <HiOutlineArrowRight className="w-4 h-4 mr-1" />
                      {tCommon('browseQuizzes')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link href="/">
            <Button variant="outline">← {tCommon('back')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
