'use client';

import { Suspense, useState, useCallback, memo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Navigation from '@/components/Navigation';
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
                    ? 'bg-white text-brand-trust shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
                }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(' ')[0]}</span>
        </button>
    );
});

function ProfileContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const t = useTranslations('profile');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const TABS = [
        { id: 'quizzes' as TabType, label: t('myQuizzes'), icon: <HiOutlineDocumentText className="w-4 h-4" /> },
        { id: 'history' as TabType, label: t('history'), icon: <HiOutlineChartBar className="w-4 h-4" /> },
        { id: 'bookmarks' as TabType, label: t('bookmarks'), icon: <HiOutlineBookmark className="w-4 h-4" /> },
    ];

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

    return (
        <div className="min-h-screen bg-neutral-50 pb-24 md:pb-8">
            {/* Navigation - Using shared component */}
            <Navigation />

            {/* Sidebar - hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={handleSidebarToggle}
                    currentPath={pathname}
                />
            </div>

            <main
                className={`pt-6 md:pt-8 pb-4 px-4 sm:px-6 lg:px-8 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-16'
                    }`}
            >
                <div className="max-w-5xl mx-auto">
                    {/* Header / Tabs */}
                    <div className="mb-6 md:mb-8">
                        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-4 md:mb-6">{t('title')}</h1>

                        <div className="flex space-x-1 bg-neutral-100 p-1 rounded-xl w-full max-w-2xl overflow-x-auto scrollbar-hide">
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
                    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 md:p-6 min-h-[400px] md:min-h-[500px]">
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
    const tCommon = useTranslations('common');

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
            <div className="text-center animate-pulse">
                <div className="w-12 h-12 bg-neutral-200 rounded-xl mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">{tCommon('loading')}</p>
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
