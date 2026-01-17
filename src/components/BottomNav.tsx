'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    HiOutlineHome,
    HiHome,
    HiOutlineInbox,
    HiInbox,
    HiOutlinePlus,
    HiPlus,
    HiOutlineSearch,
    HiSearch
} from '@/components/icons';

export default function BottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

    if (!session) return null;

    const navItems = [
        {
            href: '/',
            label: 'Home',
            icon: (isActive: boolean) => (
                isActive ? <HiHome className="w-6 h-6 text-blue-600" /> : <HiOutlineHome className="w-6 h-6 text-gray-500" />
            )
        },
        {
            href: '/review',
            label: 'Review',
            icon: (isActive: boolean) => (
                isActive ? <HiInbox className="w-6 h-6 text-blue-600" /> : <HiOutlineInbox className="w-6 h-6 text-gray-500" />
            )
        },
        {
            href: '/create',
            label: 'Create',
            icon: (isActive: boolean) => (
                <div className={`w-10 h-10 -mt-5 rounded-full flex items-center justify-center shadow-lg ${isActive ? 'bg-blue-700' : 'bg-blue-600'}`}>
                    {isActive ? <HiPlus className="w-6 h-6 text-white" /> : <HiOutlinePlus className="w-6 h-6 text-white" />}
                </div>
            )
        },
        {
            href: '/explore',
            label: 'Explore',
            icon: (isActive: boolean) => (
                isActive ? <HiSearch className="w-6 h-6 text-blue-600" /> : <HiOutlineSearch className="w-6 h-6 text-gray-500" />
            )
        },
        {
            href: '/profile',
            label: 'Profile',
            icon: (isActive: boolean) => (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-blue-600' : 'border-gray-400'}`}>
                    <span className="text-xs font-bold text-gray-500">{session.user?.email?.[0].toUpperCase()}</span>
                </div>
            )
        }
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/50 px-2 pt-2 z-50 safe-area-bottom">
            <div className="flex justify-around items-end">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const isCreate = item.href === '/create';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-3 py-1 rounded-xl transition-colors active:bg-gray-100 ${isCreate ? '' : 'gap-0.5'}`}
                        >
                            {typeof item.icon === 'function' ? item.icon(isActive) : null}
                            {!isCreate && (
                                <span className={`text-[10px] font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                                    {item.label}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
            {/* Safe Area for iPhone Home Indicator */}
            <div className="h-[env(safe-area-inset-bottom,8px)]"></div>
        </div>
    );
}
