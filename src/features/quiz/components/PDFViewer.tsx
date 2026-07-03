'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PdfPanelSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { openInNewTabSafely } from '@/lib/security/trusted-navigation';

interface PDFViewerProps {
  pdfDataUrl: string | null; // Data/object URL for inline display
  onClose: () => void;
  pdfUrl?: string | null; // Original URL for "open in new tab"
  showHeader?: boolean;
}

export default function PDFViewer({
  pdfDataUrl,
  onClose,
  pdfUrl,
  showHeader = true,
}: PDFViewerProps) {
  // Prefer inline source if provided; otherwise use the original PDF URL.
  const source = pdfDataUrl || pdfUrl || null;
  const displayUrl = source?.includes('#')
    ? source
    : source
      ? `${source}#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=page-width`
      : null;

  return (
    <div className="h-full flex flex-col">
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-neutral-900">PDF Reference</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => pdfUrl && openInNewTabSafely(pdfUrl)}
              size="sm"
              variant="outline"
              disabled={!pdfUrl}
            >
              Mở tab mới
            </Button>
            <Button onClick={onClose} size="sm" variant="ghost">
              ✕
            </Button>
          </div>
        </div>
      )}
      <div className="flex-1 border border-neutral-200 rounded overflow-hidden bg-neutral-100 flex items-center justify-center relative min-h-[400px]">
        {displayUrl ? (
          <PDFViewerFrame key={displayUrl} displayUrl={displayUrl} />
        ) : (
          <PdfPanelSkeleton label="Loading PDF" />
        )}
      </div>
    </div>
  );
}

function PDFViewerFrame({ displayUrl }: { displayUrl: string }) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {isLoading ? (
        <div className="absolute inset-0 z-10 bg-neutral-100">
          <PdfPanelSkeleton label="Loading PDF" />
        </div>
      ) : null}
      <iframe
        src={displayUrl}
        className="h-full w-full border-0"
        title="PDF Viewer"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        onLoad={() => setIsLoading(false)}
      />
    </>
  );
}
