'use client';

import { Button } from './Button';
import { HiChevronLeft, HiChevronRight } from '@/components/icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showPageNumbers?: boolean;
  maxPageNumbers?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageNumbers = true,
  maxPageNumbers = 5,
  className = ''
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    if (totalPages <= maxPageNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const delta = Math.floor(maxPageNumbers / 2);
    let start = Math.max(1, currentPage - delta);
    let end = Math.min(totalPages, start + maxPageNumbers - 1);

    if (end - start + 1 < maxPageNumbers) {
      start = Math.max(1, end - maxPageNumbers + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();

  return (
    <div className={`flex justify-center items-center space-x-2 ${className}`}>
      {/* Previous Button */}
      <Button
        variant="outline"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="h-10 min-h-[40px] px-4 py-2 rounded-full text-sm font-medium"
      >
        <HiChevronLeft className="w-4 h-4 mr-1 text-neutral-500" />
        Previous
      </Button>

      {showPageNumbers && (
        <div className="flex items-center space-x-1.5 mx-2">
          {/* First page if not visible */}
          {visiblePages[0] > 1 && (
            <>
              <Button
                variant="outline"
                onClick={() => onPageChange(1)}
                className="h-10 w-10 min-w-[40px] min-h-[40px] p-0 rounded-full text-sm font-medium flex items-center justify-center transition-colors"
              >
                1
              </Button>
              {visiblePages[0] > 2 && (
                <span className="px-1 text-neutral-500">…</span>
              )}
            </>
          )}

          {/* Visible page numbers */}
          {visiblePages.map(page => (
            <Button
              key={page}
              variant="outline"
              onClick={() => onPageChange(page)}
              className={`h-10 w-10 min-w-[40px] min-h-[40px] p-0 rounded-full text-sm font-medium flex items-center justify-center transition-colors ${
                currentPage === page
                  ? '!bg-brand-trust !text-white !border-brand-trust hover:!bg-brand-trust-hover shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {page}
            </Button>
          ))}

          {/* Last page if not visible */}
          {visiblePages[visiblePages.length - 1] < totalPages && (
            <>
              {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                <span className="px-1 text-neutral-500">…</span>
              )}
              <Button
                variant="outline"
                onClick={() => onPageChange(totalPages)}
                className="h-10 w-10 min-w-[40px] min-h-[40px] p-0 rounded-full text-sm font-medium flex items-center justify-center transition-colors"
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
        Next
        <HiChevronRight className="w-4 h-4 ml-1 text-neutral-500" />
      </Button>
    </div>
  );
}

export default Pagination;