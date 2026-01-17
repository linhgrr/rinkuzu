'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface PDFViewerProps {
  pdfDataUrl: string | null; // Base64 data URL for inline display
  onClose: () => void;
  pdfUrl?: string | null; // Original URL for "open in new tab"
}

export default function PDFViewer({ pdfDataUrl, onClose, pdfUrl }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Use pdfDataUrl for inline display (avoids download headers from S3/cloud)
  // pdfUrl is only for "open in new tab" button
  const displayUrl = pdfDataUrl;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">PDF Reference</h3>
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
      <div className="flex-1 border border-gray-200 rounded overflow-hidden bg-gray-100 flex items-center justify-center relative min-h-[400px]">
        {displayUrl ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-100 z-10">
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
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
            <span>Loading PDF...</span>
          </div>
        )}
      </div>
    </div>
  );
}
