'use client';

import { Suspense, useState, useEffect, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import CategorySearch from '@/components/ui/CategorySearch';
import { formatDisplayDate } from '@/shared/utils/constants';
import {
    HiOutlineSearch,
    HiOutlineQuestionMarkCircle,
    HiOutlineArrowRight,
    HiOutlineX
} from 'react-icons/hi';

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
    createdAt: string;
    questions: unknown[];
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const CategoryBadgeVariant = (color: string) => {
    const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'default'> = {
        'bg-blue-100': 'info', 'bg-green-100': 'success', 'bg-yellow-100': 'warning',
        'bg-red-100': 'danger', 'bg-purple-100': 'purple'
    };
    return map[color] || 'default';
};

interface QuizCardProps {
    quiz: Quiz;
    onClick: () => void;
}

const QuizCard = memo(function QuizCard({ quiz, onClick }: QuizCardProps) {
    return (
        <Card
            className="flex flex-col h-full hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={onClick}
        >
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                    <Badge variant={CategoryBadgeVariant(quiz.category?.color)}>
                        {quiz.category?.name || 'General'}
                    </Badge>
                    <span className="text-xs text-gray-400">
                        {formatDisplayDate(quiz.createdAt)}
                    </span>
                </div>
                <CardTitle className="line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {quiz.title}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                    {quiz.description}
                </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
                <div className="flex items-center justify-between text-sm text-gray-500 border-t pt-4 mt-2">
                    <span className="flex items-center gap-1">
                        <HiOutlineQuestionMarkCircle className="w-4 h-4" /> {quiz.questions.length} Questions
                    </span>
                    <span className="text-blue-600 font-medium group-hover:underline flex items-center gap-1">
                        Take Quiz <HiOutlineArrowRight className="w-4 h-4" />
                    </span>
                </div>
            </CardContent>
        </Card>
    );
});

const LoadingSkeleton = memo(function LoadingSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="animate-pulse">
                    <div className="h-48 bg-gray-200 rounded-t-xl"></div>
                    <CardContent className="p-4 space-y-3">
                        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
});

const EmptyState = memo(function EmptyState({ onClear }: { onClear: () => void }) {
    return (
        <div className="text-center py-20">
            <HiOutlineSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900">No quizzes found</h3>
            <p className="text-gray-500 mt-2">Try adjusting your search or category filter</p>
            <Button
                variant="ghost"
                className="mt-4"
                onClick={onClear}
            >
                Clear all filters
            </Button>
        </div>
    );
});

function ExploreContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1, limit: 12, total: 0, totalPages: 0
    });

    // Filters
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState<string | null>(null);

    const fetchQuizzes = useCallback(async (page: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
                status: 'published'
            });

            if (search) params.append('search', search);
            if (categoryId) params.append('category', categoryId);

            const res = await fetch(`/api/quizzes?${params}`);
            const data = await res.json();

            if (data.success) {
                setQuizzes(data.data.quizzes);
                setPagination(data.data.pagination);
            }
        } catch (error) {
            console.error('Failed to fetch quizzes', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.limit, search, categoryId]);

    useEffect(() => {
        fetchQuizzes(1);
    }, [categoryId, fetchQuizzes]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchQuizzes(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, fetchQuizzes]);

    const handlePageChange = useCallback((newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
        fetchQuizzes(newPage);
    }, [fetchQuizzes]);

    const handleQuizClick = useCallback((slug: string) => {
        router.push(`/quiz/${slug}`);
    }, [router]);

    const handleSidebarToggle = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
    }, []);

    const handleClearFilters = useCallback(() => {
        setSearch('');
        setCategoryId(null);
    }, []);

    const handleClearCategory = useCallback(() => {
        setCategoryId(null);
    }, []);

    return (
        <div className="min-h-screen bg-[#f5f5f7]">
            <Navigation />

            {session && (
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={handleSidebarToggle}
                    currentPath="/explore"
                />
            )}

            <main className={`py-8 px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
                session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : 'max-w-6xl mx-auto'
            }`}>
                <div className={session ? "max-w-6xl mx-auto" : ""}>

                    {/* Header & Search */}
                    <div className="mb-8 space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Explore Quizzes</h1>
                                <p className="text-gray-600">Discover new subjects and challenge yourself</p>
                            </div>
                            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                                <div className="w-full sm:w-64">
                                    <input
                                        type="text"
                                        placeholder="Search quizzes..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={search}
                                        onChange={handleSearchChange}
                                    />
                                </div>
                                <div className="w-full sm:w-64 relative z-20">
                                    <CategorySearch
                                        showInHomepage={true}
                                        onCategorySelect={setCategoryId}
                                    />
                                </div>
                            </div>
                        </div>

                        {categoryId && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">Filtered by category:</span>
                                <Badge
                                    variant="default"
                                    className="flex items-center gap-1 cursor-pointer hover:bg-gray-200"
                                    onClick={handleClearCategory}
                                >
                                    Category Filter Active (Click to Clear) <HiOutlineX className="inline-block ml-1" />
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Quiz Grid */}
                    {loading ? (
                        <LoadingSkeleton />
                    ) : quizzes.length === 0 ? (
                        <EmptyState onClear={handleClearFilters} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {quizzes.map(quiz => (
                                <QuizCard
                                    key={quiz._id}
                                    quiz={quiz}
                                    onClick={() => handleQuizClick(quiz.slug)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="mt-12 flex justify-center">
                            <Pagination
                                currentPage={pagination.page}
                                totalPages={pagination.totalPages}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function ExploreFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
            <div className="text-center animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-4" />
                <p className="text-[#86868b]">Loading explore...</p>
            </div>
        </div>
    );
}

export default function ExplorePage() {
    return (
        <Suspense fallback={<ExploreFallback />}>
            <ExploreContent />
        </Suspense>
    );
}
