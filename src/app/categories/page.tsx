'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import Navigation from '@/components/Navigation';
import {
  HiOutlineSearch,
  HiOutlineExclamationCircle,
  HiOutlineEmojiHappy,
  HiOutlineInbox,
  HiOutlineArrowRight
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
  const { data: session, status } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCategories = async () => {
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
  };

  useEffect(() => {
    if (status === 'loading') return;

    if (session) {
      fetchCategories();
    } else {
      router.push('/login');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = categories.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(categories);
    }
  }, [searchTerm, categories]);

  const getCategoryColor = (color: string) => {
    const colorMap: { [key: string]: string } = {
      'blue': 'bg-blue-100 text-blue-700 border-blue-200',
      'green': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'purple': 'bg-violet-100 text-violet-700 border-violet-200',
      'red': 'bg-red-100 text-red-700 border-red-200',
      'yellow': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'indigo': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'pink': 'bg-pink-100 text-pink-700 border-pink-200',
      'gray': 'bg-gray-100 text-gray-700 border-gray-200',
      'cyan': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'orange': 'bg-orange-100 text-orange-700 border-orange-200',
      'teal': 'bg-teal-100 text-teal-700 border-teal-200',
    };
    return colorMap[color?.toLowerCase()] || colorMap['purple'];
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <div className="flex justify-center items-center h-64">
            <div className="h-16 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <img src="https://i.ibb.co/WWGXBZXm/image-removebg-preview.png" alt="RinKuzu Logo" className="h-16 w-auto object-contain" />
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
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4 md:mb-6">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">All Categories</span>
        </nav>

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">All Categories</h1>
          <p className="text-sm md:text-base text-gray-600">
            Explore quizzes by subject and find what interests you most
          </p>
        </div>

        {/* Search */}
        <div className="mb-6 md:mb-8">
          <Card variant="glass" className="p-4 md:p-6 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={
                    <HiOutlineSearch className="w-5 h-5" />
                  }
                  className="w-full"
                />
              </div>
              {searchTerm && (
                <Button
                  variant="ghost"
                  onClick={() => setSearchTerm('')}
                  className="text-violet-600 hover:text-violet-700 w-full sm:w-auto"
                >
                  Clear
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <p className="text-sm md:text-base text-gray-600">
            Showing {filteredCategories.length} of {categories.length} categories
            {searchTerm && (
              <span className="ml-2">
                matching "<strong>{searchTerm}</strong>"
              </span>
            )}
          </p>
        </div>

        {/* Categories Grid */}
        {filteredCategories.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <HiOutlineInbox className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">No categories found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? "Try adjusting your search criteria or browse all categories."
                : "No categories available yet."
              }
            </p>
            {searchTerm && (
              <Button
                variant="gradient"
                onClick={() => setSearchTerm('')}
                className="mx-auto"
              >
                View All Categories
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
                className="group animate-fadeInUp cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => router.push(`/category/${category.slug}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-3">
                    <Badge
                      variant="purple"
                      size="sm"
                      className={getCategoryColor(category.color)}
                    >
                      {category.name}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {category.quizCount} quiz{category.quizCount !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <CardTitle size="md" className="group-hover:text-violet-600 transition-colors">
                    {category.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {category.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-500">
                        {category.quizCount} quiz{category.quizCount !== 1 ? 'es' : ''} available
                      </span>
                    </div>

                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/category/${category.slug}`);
                      }}
                    >
                      <HiOutlineArrowRight className="w-4 h-4 mr-1" />
                      Explore
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
            <Button variant="outline">
              ← Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 