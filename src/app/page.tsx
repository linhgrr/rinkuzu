'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
  questions: Array<any>;
  status: string;
  isPrivate: boolean;
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

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [hotCategories, setHotCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });

  // Check authentication
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }
    
    fetchCategories();
    fetchQuizzes();
  }, [session, status, router]);

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const response = await fetch('/api/categories/stats');
      const data = await response.json();

      if (data.success) {
        setHotCategories(data.data.hotCategories);
        setAllCategories(data.data.allCategories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchQuizzes = async (page: number = 1, search: string = '', categoryId: string = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: 'published',
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      if (search.trim()) {
        params.append('search', search.trim());
      }

      if (categoryId.trim()) {
        params.append('category', categoryId.trim());
      }

      const response = await fetch(`/api/quizzes?${params}`);
      const data = await response.json();

      if (data.success) {
        setQuizzes(data.data.quizzes);
        setPagination(data.data.pagination);
        setError('');
      } else {
        setError(data.error || 'Failed to fetch quizzes');
      }
    } catch (error) {
      setError('An error occurred while fetching quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchQuizzes(1, searchTerm, selectedCategory);
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchQuizzes(1, searchTerm, categoryId);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchQuizzes(newPage, searchTerm, selectedCategory);
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

  // Show loading state
  if (status === 'loading') {
  return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <p className="text-gray-600">Loading RinKuzu...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-4">Discover Amazing Quizzes</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore engaging educational content created by educators worldwide
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              variant="gradient"
              size="lg"
              onClick={() => router.push('/create')}
              className="min-w-[200px]"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Quiz
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/pending')}
              className="min-w-[200px]"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              My Quizzes
            </Button>
          </div>
              </div>

        {/* Search and Filter Section */}
                <div className="mb-8">
          <Card variant="glass" className="p-6 backdrop-blur-xl">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-4">
                              <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search quizzes by title or topic..."
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
              </div>
            </form>

                {/* Category Filter */}
            {!categoriesLoading && hotCategories.length > 0 && (
                  <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Categories</h3>
                <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleCategoryChange('')}
                    className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                      !selectedCategory 
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg' 
                        : 'bg-white/80 text-gray-600 hover:bg-white border border-gray-200'
                        }`}
                      >
                    All Categories
                      </button>
                  {hotCategories.map((category) => (
                        <button
                          key={category._id}
                          onClick={() => handleCategoryChange(category._id)}
                      className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                            selectedCategory === category._id
                          ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg'
                          : `bg-white/80 text-gray-600 hover:bg-white border border-gray-200`
                      }`}
                        >
                      {category.name}
                      <span className="ml-2 text-xs opacity-75">({category.quizCount})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
          </Card>
              </div>

        {/* Error State */}
              {error && (
          <Card variant="bordered" className="p-6 mb-8 border-red-200 bg-red-50">
            <div className="flex items-center text-red-700">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
                </div>
          </Card>
              )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, index) => (
              <Card key={index} className="animate-pulse">
                <div className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Results Info */}
            <div className="flex items-center justify-between mb-8">
              <p className="text-gray-600">
                Showing {quizzes.length} of {pagination.total} quizzes
                {selectedCategory && (
                  <span className="ml-2">
                    in <strong>{allCategories.find(c => c._id === selectedCategory)?.name}</strong>
                  </span>
                )}
              </p>
              
              {(searchTerm || selectedCategory) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('');
                    fetchQuizzes(1, '', '');
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
                  {searchTerm || selectedCategory 
                    ? "Try adjusting your search criteria or browse all quizzes." 
                    : "Be the first to create a quiz for this platform!"
                  }
                </p>
                <Button 
                  variant="gradient" 
                  onClick={() => router.push('/create')}
                  className="mx-auto"
                >
                  Create Your First Quiz
                </Button>
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
                          {quiz.isPrivate && (
                            <Badge variant="warning" size="sm">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Private
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {quiz.questions.length} questions
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
          </>
        )}
      </div>
    </div>
  );
} 