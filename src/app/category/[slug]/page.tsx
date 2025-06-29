'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import Navigation from '@/components/Navigation';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    _id: string;
    name: string;
    color: string;
  };
  author: {
    email: string;
  };
  createdAt: string;
  questionCount: number;
  status: string;
}

interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
  quizCount: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CategoryPageProps {
  params: { slug: string };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });

  const fetchCategoryAndQuizzes = async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      
      // Build query parameters for category API
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      if (search.trim()) {
        queryParams.append('search', search.trim());
      }

      console.log('🔍 Fetching category with params:', queryParams.toString());
      console.log('📂 Slug:', params.slug);

      // Get category and quizzes in one API call
      const response = await fetch(`/api/categories/${params.slug}?${queryParams}`);
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Category not found');
        return;
      }
      
      const { category, quizzes, pagination: paginationData } = data.data;
      setCategory(category);
      setQuizzes(quizzes);
      setPagination(paginationData);
      setError('');
    } catch (error) {
      console.error('Error fetching category data:', error);
      setError('An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (session) {
      fetchCategoryAndQuizzes();
    } else {
      router.push('/login');
    }
  }, [session, status, router, params.slug]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchCategoryAndQuizzes(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchCategoryAndQuizzes(newPage, searchTerm);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <span className="text-white font-bold text-xl">R</span>
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
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span>›</span>
          <Link href="/categories" className="hover:text-gray-700">Categories</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">{category?.name}</span>
        </nav>

        {/* Category Header */}
        {category && (
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: category.color }}
              >
                {category.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
                <p className="text-gray-600 mt-1">
                  {category.description} • {category.quizCount} quiz{category.quizCount !== 1 ? 'es' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-8">
          <Card variant="glass" className="p-6 backdrop-blur-xl">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder={`Search ${category?.name} quizzes...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                  className="w-full"
                />
              </div>
              <Button type="submit" variant="gradient" className="px-8">
                Search
              </Button>
              {searchTerm && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setPagination(prev => ({ ...prev, page: 1 }));
                    fetchCategoryAndQuizzes(1, '');
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
          </Card>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-gray-600">
            Showing {quizzes.length} of {pagination.total} quizzes
            {searchTerm && (
              <span className="ml-2">
                matching "<strong>{searchTerm}</strong>"
              </span>
            )}
            {category && (
              <span className="ml-2">
                in <strong>{category.name}</strong>
              </span>
            )}
          </p>
          
          {(searchTerm) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchTerm('');
                setPagination(prev => ({ ...prev, page: 1 }));
                fetchCategoryAndQuizzes(1, '');
              }}
              className="text-violet-600 hover:text-violet-700"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Quizzes Grid */}
        {quizzes.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">No quizzes found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm 
                ? `No quizzes match "${searchTerm}" in ${category?.name}` 
                : `No quizzes available in ${category?.name} yet`
              }
            </p>
            {searchTerm && (
              <Button 
                variant="gradient" 
                onClick={() => {
                  setSearchTerm('');
                  setPagination(prev => ({ ...prev, page: 1 }));
                  fetchCategoryAndQuizzes(1, '');
                }}
                className="mx-auto"
              >
                View All {category?.name} Quizzes
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {quizzes.map((quiz, index) => (
              <Card
                key={quiz._id}
                variant="default"
                hover
                className="group animate-fadeInUp"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="purple" 
                        size="sm"
                        className={getCategoryColor(quiz.category?.color)}
                      >
                        {quiz.category?.name}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">
                      {quiz.questionCount} questions
                    </span>
                  </div>
                  <CardTitle size="md" className="group-hover:text-violet-600 transition-colors">
                    {quiz.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {quiz.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>By {quiz.author.email.split('@')[0]}</span>
                    <span>{formatDate(quiz.createdAt)}</span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="gradient"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/quiz/${quiz.slug}`);
                      }}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Take Quiz
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/quiz/${quiz.slug}/flashcards`);
                      }}
                      className="flex-1"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Flashcards
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center mt-12">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </Button>
              
              {[...Array(pagination.totalPages)].map((_, index) => {
                const page = index + 1;
                return (
                  <Button
                    key={page}
                    variant={pagination.page === page ? "gradient" : "outline"}
                    onClick={() => handlePageChange(page)}
                    className="min-w-[40px]"
                  >
                    {page}
                  </Button>
                );
              })}
              
              <Button
                variant="outline"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link href="/categories">
            <Button variant="outline">
              ← Back to All Categories
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 