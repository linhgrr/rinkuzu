'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/Button';

// Configure PDF worker from public folder (recommended for Next.js)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFViewerProps {
  pdfDataUrl: string | null;
  onClose: () => void;
  pdfUrl?: string | null;
}

export default function PDFViewer({ pdfDataUrl, onClose, pdfUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">PDF Reference</h3>
        <div className="flex gap-2">
          {/* Pagination Controls */}
          {numPages && (
            <div className="flex items-center gap-2 mr-4 text-sm text-gray-600 bg-gray-100 rounded-lg px-2">
              <button
                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                className="p-1 hover:text-blue-600 disabled:opacity-30"
              >
                Prev
              </button>
              <span>{pageNumber} / {numPages}</span>
              <button
                onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                className="p-1 hover:text-blue-600 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}

          <Button
            onClick={() => pdfUrl && window.open(pdfUrl, '_blank')}
            size="sm"
            variant="outline"
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
      <div className="flex-1 border border-gray-200 rounded overflow-hidden bg-gray-100 flex items-center justify-center relative">
        {pdfDataUrl ? (
          <div className="w-full h-full overflow-auto flex justify-center py-4">
            <Document
              file={pdfDataUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              className="shadow-lg"
            >
              <Page
                pageNumber={pageNumber}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                width={600} // Approximate width, or make dynamic
                className="bg-white shadow-md mb-4"
              />
            </Document>
          </div>
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