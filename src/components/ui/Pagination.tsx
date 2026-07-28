'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showPageNumbers?: boolean;
  maxPageNumbers?: number;
  className?: string;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageNumbers = true,
  maxPageNumbers = 5,
  className = '',
}: PaginationProps) {
  const tCommon = useTranslations('common');

  if (totalPages <= 1) return null;
  const safeMaxPageNumbers = Math.max(1, Math.floor(maxPageNumbers));

  const getVisiblePages = () => {
    if (totalPages <= safeMaxPageNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const delta = Math.floor(safeMaxPageNumbers / 2);
    let start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, start + safeMaxPageNumbers - 1);

    if (end - start + 1 < safeMaxPageNumbers) {
      start = Math.max(1, end - safeMaxPageNumbers + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();
  const firstVisiblePage = visiblePages[0];
  const lastVisiblePage = visiblePages[visiblePages.length - 1];

  return (
    <div className={`flex justify-center items-center space-x-2 ${className}`}>
      {/* Previous Button */}
      <Button
        variant="outline"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="h-10 min-h-[40px] px-4 py-2 rounded-full text-sm font-medium"
      >
        <HiChevronLeft className="size-4 mr-1 text-neutral-500" />
        {tCommon('previous')}
      </Button>

      {showPageNumbers && (
        <div className="flex items-center gap-x-1.5 mx-2">
          {/* First page if not visible */}
          {firstVisiblePage !== undefined && firstVisiblePage > 1 && (
            <>
              <Button
                variant="outline"
                onClick={() => onPageChange(1)}
                className="size-10 min-w-[40px] min-h-[40px] p-0 rounded-full text-sm font-medium flex items-center justify-center transition-colors"
              >
                1
              </Button>
              {firstVisiblePage > 2 && <span className="px-1 text-neutral-500">…</span>}
            </>
          )}

          {/* Visible page numbers */}
          {visiblePages.map((page) => (
            <Button
              key={page}
              variant="outline"
              onClick={() => onPageChange(page)}
              className={`h-10 w-10 min-w-[40px] min-h-[40px] p-0 rounded-full font-home text-sm font-semibold flex items-center justify-center transition-colors ${
                currentPage === page
                  ? '!border-brand-action !bg-brand-action !text-white shadow-sm'
                  : 'font-home text-ink hover:bg-surface-blue'
              }`}
            >
              {page}
            </Button>
          ))}

          {/* Last page if not visible */}
          {lastVisiblePage !== undefined && lastVisiblePage < totalPages && (
            <>
              {lastVisiblePage < totalPages - 1 && <span className="px-1 text-neutral-500">…</span>}
              <Button
                variant="outline"
                onClick={() => onPageChange(totalPages)}
                className="size-10 min-w-[40px] min-h-[40px] p-0 rounded-full text-sm font-medium flex items-center justify-center transition-colors"
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Next Button */}
      <Button
        variant="outline"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="h-10 min-h-[40px] px-4 py-2 rounded-full text-sm font-medium"
      >
        {tCommon('next')}
        <HiChevronRight className="size-4 ml-1 text-neutral-500" />
      </Button>
    </div>
  );
}

export default Pagination;
