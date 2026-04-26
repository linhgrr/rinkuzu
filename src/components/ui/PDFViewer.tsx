'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface PDFViewerProps {
  pdfDataUrl: string | null; // Data/object URL for inline display
  onClose: () => void;
  pdfUrl?: string | null; // Original URL for "open in new tab"
  showHeader?: boolean;
}

export default function PDFViewer({ pdfDataUrl, onClose, pdfUrl, showHeader = true }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Prefer inline source if provided, otherwise fallback to original URL.
  const displayUrl = useMemo(() => {
    const source = pdfDataUrl || pdfUrl || null;
    if (!source) return null;
    return source.includes('#')
      ? source
      : `${source}#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=page-width`;
  }, [pdfDataUrl, pdfUrl]);

  useEffect(() => {
    setIsLoading(true);
  }, [displayUrl]);

  return (
    <div className="h-full flex flex-col">
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-neutral-900">PDF Reference</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => pdfUrl && window.open(pdfUrl, '_blank')}
              size="sm"
              variant="outline"
              disabled={!pdfUrl}
            >
              Mở tab mới
            </Button>
            <Button
              onClick={onClose}
              size="sm"
              variant="ghost"
            >
              ✕
            </Button>
          </div>
        </div>
      )}
      <div className="flex-1 border border-neutral-200 rounded overflow-hidden bg-neutral-100 flex items-center justify-center relative min-h-[400px]">
        {displayUrl ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-400 bg-neutral-100 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                <span>Loading PDF...</span>
              </div>
            )}
            <iframe
              src={displayUrl}
              className="w-full h-full border-0"
              title="PDF Viewer"
              onLoad={() => setIsLoading(false)}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
            <span>Loading PDF...</span>
          </div>
        )}
      </div>
    </div>
  );
}
