'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/">
              <Button>← Back to Home</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span>›</span>
          <span className="text-gray-900">Categories</span>
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
          <form onSubmit={handleSearch} className="flex gap-4 max-w-2xl">
            <div className="flex-1">
              <Input
                type="text"
                placeholder={`Search ${category?.name} quizzes...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={loading}>
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
        </div>

        {/* Results Info */}
        {!loading && (
          <div className="mb-6 text-sm text-gray-600">
            {searchTerm ? (
              <p>
                Found {pagination.total} quiz{pagination.total !== 1 ? 'es' : ''} 
                {searchTerm && ` matching "${searchTerm}"`} in {category?.name}
              </p>
            ) : (
              <p>
                Showing {pagination.total} quiz{pagination.total !== 1 ? 'es' : ''} in {category?.name}
              </p>
            )}
          </div>
        )}

        {/* Quizzes Grid */}
        {!loading && quizzes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {quizzes.map((quiz) => (
              <Card key={quiz._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{quiz.title}</CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    By {quiz.author.email} • {formatDate(quiz.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {quiz.description || 'No description available'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {quiz.questionCount} questions
                    </span>
                    <div className="flex space-x-2">
                      <Link href={`/quiz/${quiz.slug}/flashcards`}>
                        <Button size="sm" variant="outline" className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100">
                          🗂️ Flashcards
                        </Button>
                      </Link>
                      <Link href={`/quiz/${quiz.slug}`}>
                        <Button size="sm">
                          Take Quiz
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* No Results */}
        {!loading && quizzes.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">{category && String.fromCodePoint(0x1F4D6)}</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No quizzes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm 
                ? `No quizzes match "${searchTerm}" in ${category?.name}`
                : `No quizzes available in ${category?.name} yet`
              }
            </p>
            {searchTerm && (
              <div className="mt-6">
                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setPagination(prev => ({ ...prev, page: 1 }));
                    fetchCategoryAndQuizzes(1, '');
                  }}
                  variant="outline"
                >
                  View All {category?.name} Quizzes
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                variant="outline"
              >
                Previous
              </Button>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {((pagination.page - 1) * pagination.limit) + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <Button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    variant="outline"
                    size="sm"
                    className="rounded-r-none"
                  >
                    Previous
                  </Button>
                  
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        variant={pagination.page === pageNum ? "default" : "outline"}
                        size="sm"
                        className="rounded-none"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  
                  <Button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    variant="outline"
                    size="sm"
                    className="rounded-l-none"
                  >
                    Next
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link href="/">
            <Button variant="outline">
              ← Back to All Subjects
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
} 