'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Modal } from './Modal';

interface PDFViewerProps {
  pdfFiles: File[];
  isVisible: boolean;
  onToggle: () => void;
}

export function PDFViewer({ pdfFiles, isVisible, onToggle }: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(0);

  // Load and merge PDF files
  useEffect(() => {
    if (pdfFiles.length === 0) {
      setPdfUrl('');
      setTotalPages(0);
      return;
    }

    loadPDFs();
  }, [pdfFiles]);

  const loadPDFs = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (pdfFiles.length === 1) {
        // Single file - create URL directly
        const url = URL.createObjectURL(pdfFiles[0]);
        setPdfUrl(url);
        
        // Count pages
        await countPDFPages(pdfFiles[0]);
      } else {
        // Multiple files - merge them
        await mergePDFs();
      }
    } catch (err) {
      console.error('Error loading PDFs:', err);
      setError('Failed to load PDF files');
    } finally {
      setLoading(false);
    }
  };

  const countPDFPages = async (file: File) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
    } catch (err) {
      console.error('Error counting pages:', err);
      setTotalPages(0);
    }
  };

  const mergePDFs = async () => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      
      // Import PDF-lib for merging
      const { PDFDocument } = await import('pdf-lib');
      
      const mergedPdf = await PDFDocument.create();
      let totalPageCount = 0;
      
      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pageIndices = pdf.getPageIndices();
        
        const pages = await mergedPdf.copyPages(pdf, pageIndices);
        pages.forEach((page) => mergedPdf.addPage(page));
        
        totalPageCount += pageIndices.length;
      }
      
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setPdfUrl(url);
      setTotalPages(totalPageCount);
    } catch (err) {
      console.error('Error merging PDFs:', err);
      setError('Failed to merge PDF files');
    }
  };

  // Cleanup URL when component unmounts
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Mobile view - show as modal
  const mobileView = (
    <Modal
      isOpen={isVisible}
      onClose={onToggle}
      title="PDF Reference"
      size="large"
    >
      <div className="h-96 flex flex-col">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">
                {pdfFiles.length > 1 ? 'Merging PDFs...' : 'Loading PDF...'}
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-red-600">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        
        {!loading && !error && pdfFiles.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-sm">No PDF files uploaded</p>
            </div>
          </div>
        )}
        
        {!loading && !error && pdfUrl && (
          <>
            {/* Info */}
            <div className="flex-shrink-0 mb-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {pdfFiles.length} file{pdfFiles.length !== 1 ? 's' : ''} • {totalPages} pages
                </span>
                <Button
                  onClick={() => window.open(pdfUrl, '_blank')}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  🔗 Open in New Tab
                </Button>
              </div>
            </div>
            
            {/* PDF Viewer */}
            <div className="flex-1 border border-gray-200 rounded overflow-hidden">
              <iframe
                src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full"
                title="PDF Viewer"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );

  if (!isVisible) {
    return (
      <>
        {/* Desktop toggle button */}
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-30 lg:block hidden">
          <Button
            onClick={onToggle}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            size="sm"
          >
            📄 Show PDF ({pdfFiles.length})
          </Button>
        </div>
        {/* Mobile modal */}
        <div className="lg:hidden">
          {mobileView}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop sticky viewer */}
      <div className="fixed right-4 top-24 bottom-4 w-[25vw] z-30 lg:block hidden">
        <Card className="h-full flex flex-col shadow-2xl border-2 border-blue-200 bg-white">
          <CardHeader className="flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">PDF Reference</CardTitle>
              <Button
                onClick={onToggle}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
            
            {pdfFiles.length > 0 && (
              <div className="text-sm text-gray-600">
                {pdfFiles.length} file{pdfFiles.length !== 1 ? 's' : ''} • {totalPages} pages total
              </div>
            )}
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-4 min-h-0">
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">
                    {pdfFiles.length > 1 ? 'Merging PDFs...' : 'Loading PDF...'}
                  </p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-red-600">
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
            
            {!loading && !error && pdfFiles.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="text-sm">No PDF files uploaded</p>
                </div>
              </div>
            )}
            
            {!loading && !error && pdfUrl && (
              <>
                {/* Controls */}
                <div className="flex-shrink-0 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {totalPages} pages total
                    </span>
                    <Button
                      onClick={() => window.open(pdfUrl, '_blank')}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      🔗 Open in New Tab
                    </Button>
                  </div>
                </div>
                
                {/* PDF Viewer */}
                <div className="flex-1 border border-gray-200 rounded overflow-hidden">
                  <iframe
                    src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                    className="w-full h-full"
                    title="PDF Viewer"
                  />
                </div>
                
                {/* File info */}
                {pdfFiles.length > 1 && (
                  <div className="flex-shrink-0 mt-2 text-xs text-gray-500">
                    <div className="space-y-1">
                      <div className="font-medium">Merged files:</div>
                      {pdfFiles.map((file, index) => (
                        <div key={index} className="truncate">
                          📄 {file.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Mobile modal */}
      <div className="lg:hidden">
        {mobileView}
      </div>
    </>
  );
} 