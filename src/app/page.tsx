'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CategorySearch from '@/components/ui/CategorySearch';
import {
  EMOTIONS,
  EMOTION_LABELS,
  MAGIC_EFFECTS,
  ANIMATIONS,
  COLORS,
  LAYOUT,
  API_ENDPOINTS,
  QUERY_PARAMS,
  QUIZ_STATUS,
  EXTERNAL_APIS,
  APP_CONFIG,
  ROUTES,
  type EmotionType
} from '@/shared/constants';
import {
  getCategoryColorClass,
  getRandomEmotion,
  getNextEmotion,
  formatDisplayDate,
  createQuizSearchParams
} from '@/shared/utils/constants';

// Interactive Anime Portal Component - WOW FACTOR! 🌸✨
function WelcomeGif() {
  const [gifUrl, setGifUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [emotion, setEmotion] = useState<EmotionType>('happy');
  const [isHovered, setIsHovered] = useState(false);
  
  const fetchRandomGif = async (currentEmotion = emotion) => {
    try {
      setLoading(true);
      const response = await fetch(EXTERNAL_APIS.NEKOS_BEST.ENDPOINTS.EMOTION(currentEmotion));
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        setGifUrl(data.results[0].url);
      }
    } catch (error) {
      console.error('Failed to fetch GIF:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeEmotion = () => {
    const nextEmotion = getNextEmotion(emotion);
    setEmotion(nextEmotion);
    fetchRandomGif(nextEmotion);
  };

  useEffect(() => {
    fetchRandomGif();
    // Auto change emotion for dynamic feel
    const interval = setInterval(() => {
      const randomEmotion = getRandomEmotion();
      setEmotion(randomEmotion);
      fetchRandomGif(randomEmotion);
    }, ANIMATIONS.EMOTION_CHANGE_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="relative w-40 h-40 mx-auto mb-6">
        {/* Magic Circle Loading */}
        <div className="absolute inset-0 rounded-full border-4 border-dashed border-purple-400 animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-2 border-blue-400 animate-ping"></div>
        <div className="absolute inset-4 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full flex items-center justify-center">
          <div className="text-2xl">✨</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-40 h-40 mx-auto mb-6 group">
      {/* Floating Sakura Petals */}
      <div className="absolute -inset-8 pointer-events-none">
        {[...Array(MAGIC_EFFECTS.SAKURA_COUNT)].map((_, i) => (
          <div
            key={i}
            className="absolute text-pink-400 text-lg animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          >
            🌸
          </div>
        ))}
      </div>

      {/* Magic Circle Background */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 opacity-20 animate-pulse"></div>
      <div className="absolute inset-1 rounded-full border-2 border-dashed border-purple-300 animate-spin" style={{ animationDuration: '20s' }}></div>
      <div className="absolute inset-3 rounded-full border border-pink-300 animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }}></div>

      {/* Glowing Orbs */}
      <div className="absolute inset-0">
        {[...Array(MAGIC_EFFECTS.GLOWING_ORBS_COUNT)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-yellow-400 to-pink-400 rounded-full animate-ping"
            style={{
              left: `${20 + i * 20}%`,
              top: `${20 + i * 20}%`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* Main Character Portal */}
      <div 
        className={`absolute inset-4 rounded-full overflow-hidden shadow-2xl cursor-pointer transform transition-all duration-500 ${
          isHovered ? 'scale-110 shadow-purple-500/50' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={changeEmotion}
      >
        {/* Magical Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-30 animate-pulse"></div>
        
        {/* Character Image */}
        <img 
          src={gifUrl}
          alt={`Anime Character - ${emotion}`}
          className="w-full h-full object-cover relative z-10"
          onError={(e) => {
            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24' fill='none' stroke='%23a855f7' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M8 14s1.5 2 4 2 4-2 4-2'/%3E%3Cline x1='9' y1='9' x2='9.01' y2='9'/%3E%3Cline x1='15' y1='9' x2='15.01' y2='9'/%3E%3C/svg%3E";
          }}
        />
      </div>

      {/* Emotion Indicator */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-3 py-1 rounded-full shadow-lg">
        {EMOTION_LABELS[emotion]}
      </div>

      {/* Sparkle Effects */}
      {isHovered && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(MAGIC_EFFECTS.SPARKLES_COUNT)].map((_, i) => (
            <div
              key={i}
              className="absolute text-yellow-400 text-sm animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.1}s`
              }}
            >
              ✨
            </div>
          ))}
        </div>
      )}

      {/* Click hint */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
        Click to change emotion! 🎭
      </div>
    </div>
  );
}

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
    page: LAYOUT.PAGINATION.DEFAULT_PAGE,
    limit: LAYOUT.PAGINATION.DEFAULT_LIMIT,
    total: 0,
    totalPages: 0
  });

  // Check authentication
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push(ROUTES.LOGIN);
      return;
    }
    
    fetchCategories();
    fetchQuizzes();
  }, [session, status, router]);

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const response = await fetch(API_ENDPOINTS.CATEGORY.STATS);
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
      const params = createQuizSearchParams(
        page,
        pagination.limit,
        QUIZ_STATUS.PUBLISHED,
        search,
        categoryId
      );

      const response = await fetch(`${API_ENDPOINTS.QUIZ.BASE}?${params}`);
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

  const handleCategoryChange = (categoryId: string | null) => {
    setSelectedCategory(categoryId || '');
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchQuizzes(1, searchTerm, categoryId || '');
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchQuizzes(newPage, searchTerm, selectedCategory);
  };





  // Show loading state
  if (status === 'loading') {
  return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <p className="text-gray-600">Loading {APP_CONFIG.NAME}...</p>
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
            <WelcomeGif />
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              variant="gradient"
              size="lg"
              onClick={() => router.push(ROUTES.CREATE_QUIZ)}
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
              onClick={() => router.push(ROUTES.PENDING_QUIZZES)}
              className="min-w-[200px]"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              My Quizzes
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push(ROUTES.CATEGORIES)}
              className="min-w-[200px]"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              All Categories
            </Button>

            {/* Quick Category Search */}
            <div className="min-w-[250px]">
              <CategorySearch 
                showInHomepage={true} 
                onCategorySelect={handleCategoryChange}
              />
            </div>
          </div>
              </div>

        {/* Simplified Search Section */}
        <div className="mb-8">
          <Card variant="glass" className="p-6 backdrop-blur-xl">
            {/* Main Search Bar */}
            <form onSubmit={handleSearch} className="mb-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search quizzes by title, topic, or keyword..."
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

            {/* Search Tips */}
            <div className="text-center text-sm text-gray-500">
              {selectedCategory && (
                <span className="ml-4 text-blue-600">
                  Currently filtering: <strong>{allCategories.find(c => c._id === selectedCategory)?.name}</strong>
                  <button 
                    onClick={() => handleCategoryChange('')}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
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
                  onClick={() => router.push(ROUTES.CREATE_QUIZ)}
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
                    style={{ animationDelay: `${index * ANIMATIONS.CARD_STAGGER_DELAY}ms` }}
                  >
                      <CardHeader>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="purple" 
                            size="sm"
                            className={getCategoryColorClass(quiz.category?.color)}
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
                        <span>{formatDisplayDate(quiz.createdAt)}</span>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="gradient"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(ROUTES.QUIZ.VIEW(quiz.slug));
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
                            router.push(ROUTES.QUIZ.FLASHCARDS(quiz.slug));
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