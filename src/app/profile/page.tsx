'use client';

import { Suspense, useState, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import ProfileQuizzes from '@/components/profile/ProfileQuizzes';
import ProfileHistory from '@/components/profile/ProfileHistory';
import ProfileBookmarks from '@/components/profile/ProfileBookmarks';
import {
    HiOutlineDocumentText,
    HiOutlineChartBar,
    HiOutlineBookmark,
} from '@/components/icons';

type TabType = 'quizzes' | 'history' | 'bookmarks';

interface TabButtonProps {
    id: TabType;
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: (tab: TabType) => void;
}

const TabButton = memo(function TabButton({ id, label, icon, isActive, onClick }: TabButtonProps) {
    const handleClick = useCallback(() => onClick(id), [id, onClick]);

    return (
        <button
            onClick={handleClick}
            className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 min-h-[44px] rounded-lg text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-1 ${isActive
                    ? 'bg-white text-[#0071e3] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(' ')[0]}</span>
        </button>
    );
});

const TABS = [
    { id: 'quizzes' as TabType, label: 'My Quizzes', icon: <HiOutlineDocumentText className="w-4 h-4" /> },
    { id: 'history' as TabType, label: 'History', icon: <HiOutlineChartBar className="w-4 h-4" /> },
    { id: 'bookmarks' as TabType, label: 'Bookmarks', icon: <HiOutlineBookmark className="w-4 h-4" /> },
];

function ProfileContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const initialTab = (searchParams.get('tab') as TabType | null) || 'quizzes';
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(new Set([initialTab]));

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
        setVisitedTabs(prev => new Set(prev).add(tab));
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`);
    }, [router, pathname, searchParams]);

    const handleSidebarToggle = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!session) {
        if (typeof window !== 'undefined') router.push('/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-8">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 h-14 md:h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
                    <div className="flex justify-between items-center h-full">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-[#0071e3] rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold">R</span>
                                </div>
                                <span className="text-xl font-semibold text-[#1d1d1f] hidden sm:block">RinKuzu</span>
                            </Link>
                        </div>

                        <div className="hidden md:flex items-center gap-4">
                            <span className="text-sm text-gray-600">Welcome, {session.user?.name || session.user?.email}</span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Sidebar - hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={handleSidebarToggle}
                    currentPath={pathname}
                />
            </div>

            <main
                className={`pt-16 md:pt-20 pb-4 px-4 sm:px-6 lg:px-8 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-16'
                    }`}
            >
                <div className="max-w-5xl mx-auto">
                    {/* Header / Tabs */}
                    <div className="mb-6 md:mb-8">
                        <h1 className="text-2xl md:text-3xl font-bold text-[#1d1d1f] mb-4 md:mb-6">Profile</h1>

                        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-full max-w-2xl overflow-x-auto scrollbar-hide">
                            {TABS.map((tab) => (
                                <TabButton
                                    key={tab.id}
                                    id={tab.id}
                                    label={tab.label}
                                    icon={tab.icon}
                                    isActive={activeTab === tab.id}
                                    onClick={handleTabChange}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 min-h-[400px] md:min-h-[500px]">
                        {visitedTabs.has('quizzes') && (
                            <div className={activeTab === 'quizzes' ? '' : 'hidden'}>
                                <ProfileQuizzes />
                            </div>
                        )}
                        {visitedTabs.has('history') && (
                            <div className={activeTab === 'history' ? '' : 'hidden'}>
                                <ProfileHistory />
                            </div>
                        )}
                        {visitedTabs.has('bookmarks') && (
                            <div className={activeTab === 'bookmarks' ? '' : 'hidden'}>
                                <ProfileBookmarks />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function ProfileFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
            <div className="text-center animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-4" />
                <p className="text-[#86868b]">Loading profile...</p>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<ProfileFallback />}>
            <ProfileContent />
        </Suspense>
    );
}
