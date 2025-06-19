'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Sidebar from '@/components/Sidebar';

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
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

  useEffect(() => {
    if (status === 'loading') return; // Đợi session load xong
    
    if (session) {
      fetchCategories();
      fetchQuizzes();
    } else {
      router.push('/login');
    }
  }, [session, status, router]);

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

  const getCategorySlug = (categoryName: string) => {
    return categoryName.toLowerCase().replace(/\s+/g, '-');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {session ? (
                <>
                  <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                    All Quizzes
                  </Link>
                  
                  {/* User Menu */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {session.user?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <svg className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                        <button 
                          onClick={() => signOut()}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link href="/login">
                    <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-4">
              <div className="space-y-2">
                {session ? (
                  <>
                    <Link href="/" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      All Quizzes
                    </Link>
                    <button 
                      onClick={() => signOut()}
                      className="block w-full text-left px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Sign In
                    </Link>
                    <Link href="/register" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main className={`py-8 transition-all duration-300 ${
        session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : ''
      } max-w-none px-4 sm:px-6 lg:px-8`}>
        {status === 'loading' ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : !session ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Redirecting to login...</div>
          </div>
        ) : (
          <>
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">All Quizzes</h1>
                <p className="mt-2 text-gray-600">
                  Explore all published quizzes from the community
                </p>
              </div>

              {/* Hot Categories Section */}
              {!categoriesLoading && hotCategories.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">🔥 Hot Subjects</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {hotCategories.map((category) => (
                      <Link
                        key={category._id}
                        href={`/category/${getCategorySlug(category.name)}`}
                        className="group"
                      >
                        <Card className="hover:shadow-lg transition-all duration-200 group-hover:scale-105">
                          <CardContent className="p-6">
                            <div className="flex items-center space-x-4">
                              <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                                style={{ backgroundColor: category.color }}
                              >
                                {category.name.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                  {category.name}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {category.quizCount} quiz{category.quizCount !== 1 ? 'es' : ''}
                                </p>
                              </div>
                              <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Filter & Search */}
              <div className="mb-8 space-y-4">
                {/* Category Filter */}
                {!categoriesLoading && allCategories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Subject:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleCategoryChange('')}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                          selectedCategory === ''
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All Subjects
                      </button>
                      {allCategories.map((category) => (
                        <button
                          key={category._id}
                          onClick={() => handleCategoryChange(category._id)}
                          className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                            selectedCategory === category._id
                              ? 'text-white'
                              : 'text-gray-700 hover:opacity-80'
                          }`}
                          style={{
                            backgroundColor: selectedCategory === category._id 
                              ? category.color 
                              : category.color + '20',
                            color: selectedCategory === category._id 
                              ? 'white' 
                              : category.color
                          }}
                        >
                          {category.name} ({category.quizCount})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-4">
                  <div className="flex-1 max-w-2xl">
                    <Input
                      type="text"
                      placeholder="Search quizzes by title or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                  {searchTerm && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setSearchTerm('');
                        setPagination(prev => ({ ...prev, page: 1 }));
                        fetchQuizzes(1, '', selectedCategory);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                  <Link href="/create">
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
                      + Create Quiz
                    </Button>
                  </Link>
                </form>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-md bg-red-50 p-4 mb-6">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex justify-center py-12">
                  <div className="text-gray-500">Loading quizzes...</div>
                </div>
              )}

              {/* Results Info */}
              {!loading && (
                <div className="mb-6 text-sm text-gray-600">
                  {searchTerm || selectedCategory ? (
                    <p>
                      Found {pagination.total} quiz{pagination.total !== 1 ? 'es' : ''} 
                      {searchTerm && ` matching "${searchTerm}"`}
                      {selectedCategory && allCategories.find(cat => cat._id === selectedCategory) && 
                        ` in ${allCategories.find(cat => cat._id === selectedCategory)?.name}`}
                    </p>
                  ) : (
                    <p>
                      Showing {pagination.total} published quiz{pagination.total !== 1 ? 'es' : ''}
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
                        <div className="flex items-start justify-between mb-2">
                          <span 
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full"
                            style={{ 
                              backgroundColor: quiz.category?.color + '20', 
                              color: quiz.category?.color 
                            }}
                          >
                            {quiz.category?.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CardTitle className="line-clamp-2 flex-1">{quiz.title}</CardTitle>
                          {quiz.isPrivate && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center">
                              🔒 Private
                            </span>
                          )}
                        </div>
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
                            {quiz.questions?.length || 0} questions
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
                        
                        {/* Admin controls */}
                        {(session?.user as any)?.role === 'admin' && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex space-x-2">
                              <Link href={`/edit/${quiz._id}`}>
                                <Button size="sm" variant="outline" className="text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400">
                                  ✏️ Edit
                                </Button>
                              </Link>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                quiz.status === 'published' ? 'bg-green-100 text-green-800' : 
                                quiz.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {quiz.status}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* No Results */}
              {!loading && quizzes.length === 0 && (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No quizzes found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || selectedCategory
                      ? 'Try adjusting your search or filter criteria'
                      : 'No published quizzes available yet'
                    }
                  </p>
                  {(searchTerm || selectedCategory) && (
                    <div className="mt-6">
                      <Button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedCategory('');
                          setPagination(prev => ({ ...prev, page: 1 }));
                          fetchQuizzes(1, '', '');
                        }}
                        variant="outline"
                      >
                        View All Quizzes
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
                        
                        {/* Page Numbers */}
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
            </div>
          </>
        )}
      </main>
    </div>
  );
} 