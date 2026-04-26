import React, { memo } from 'react';

export const SkeletonCard = memo(function SkeletonCard() {
    return (
        <div className="w-full h-24 overflow-hidden rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center p-4 gap-4 mb-3">
            <div className="w-12 h-12 skeleton-shimmer rounded-xl shrink-0"></div>
            <div className="flex-1 space-y-2">
                <div className="h-5 skeleton-shimmer rounded-md w-1/3"></div>
                <div className="h-3 skeleton-shimmer rounded-md w-1/4"></div>
            </div>
            <div className="h-8 w-8 skeleton-shimmer rounded-lg shrink-0"></div>
        </div>
    );
});