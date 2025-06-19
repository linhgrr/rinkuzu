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
  const desktopCanvasRef = useRef<HTMLCanvasElement>(null);
  const mobileCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDocs, setPdfDocs] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1.2);
  const [pdfjs, setPdfjs] = useState<any>(null);

  // Initialize PDF.js
  useEffect(() => {
    const initPdfjs = async () => {
      try {
        // Dynamically import PDF.js
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set worker source to the one in public folder
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        
        setPdfjs(pdfjsLib);
      } catch (err) {
        console.error('Failed to load PDF.js:', err);
        setError('Failed to load PDF viewer');
      }
    };

    initPdfjs();
  }, []);

  // Load PDF files when they change
  useEffect(() => {
    if (!pdfjs || pdfFiles.length === 0) {
      setPdfDocs([]);
      setTotalPages(0);
      setCurrentPage(1);
      return;
    }

    loadPDFs();
  }, [pdfFiles, pdfjs]);

  // Handle window resize to re-render on correct canvas
  useEffect(() => {
    const handleResize = () => {
      if (currentPage && totalPages > 0) {
        const isMobile = window.innerWidth < 1024;
        if (isMobile) {
          renderPage(currentPage, mobileCanvasRef);
        } else {
          renderPage(currentPage, desktopCanvasRef);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentPage, totalPages, scale, pdfDocs]);

  const loadPDFs = async () => {
    if (!pdfjs) return;
    
    setLoading(true);
    setError('');
    
    try {
      const docs = [];
      let totalPageCount = 0;
      
      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        docs.push({
          doc: pdf,
          fileName: file.name,
          pageCount: pdf.numPages,
          startPage: totalPageCount + 1
        });
        totalPageCount += pdf.numPages;
      }
      
      setPdfDocs(docs);
      setTotalPages(totalPageCount);
      setCurrentPage(1);
      
      // Render first page on appropriate canvas
      if (totalPageCount > 0) {
        const isMobile = window.innerWidth < 1024; // lg breakpoint
        if (isMobile) {
          renderPage(1, mobileCanvasRef);
        } else {
          renderPage(1, desktopCanvasRef);
        }
      }
    } catch (err) {
      console.error('Error loading PDFs:', err);
      setError('Failed to load PDF files');
    } finally {
      setLoading(false);
    }
  };

  const renderPage = async (pageNum: number, canvasRef?: React.RefObject<HTMLCanvasElement>) => {
    const canvas = canvasRef?.current || desktopCanvasRef.current || mobileCanvasRef.current;
    if (!pdfDocs.length || !canvas) return;
    
    // Find which document and page this corresponds to
    let targetDoc = null;
    let targetPageNum = pageNum;
    
    for (const docInfo of pdfDocs) {
      if (pageNum <= docInfo.startPage + docInfo.pageCount - 1) {
        targetDoc = docInfo.doc;
        targetPageNum = pageNum - docInfo.startPage + 1;
        break;
      }
    }
    
    if (!targetDoc) return;
    
    try {
      const page = await targetDoc.getPage(targetPageNum);
      const viewport = page.getViewport({ scale });
      
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Failed to render page');
    }
  };

  // Render page when currentPage or scale changes
  useEffect(() => {
    if (currentPage && totalPages > 0) {
      // Render on the appropriate canvas based on screen size
      const isMobile = window.innerWidth < 1024; // lg breakpoint
      if (isMobile) {
        renderPage(currentPage, mobileCanvasRef);
      } else {
        renderPage(currentPage, desktopCanvasRef);
      }
    }
  }, [currentPage, scale, pdfDocs, isVisible]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

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
              <p className="mt-2 text-sm text-gray-600">Loading PDF...</p>
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
        
        {!loading && !error && totalPages > 0 && (
          <>
            {/* Controls */}
            <div className="flex-shrink-0 mb-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center space-x-1">
                  <Button
                    onClick={zoomOut}
                    size="sm"
                    variant="ghost"
                    className="text-xs px-2"
                  >
                    −
                  </Button>
                  <span className="text-xs text-gray-600">
                    {Math.round(scale * 100)}%
                  </span>
                  <Button
                    onClick={zoomIn}
                    size="sm"
                    variant="ghost"
                    className="text-xs px-2"
                  >
                    +
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  ← Prev
                </Button>
                
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                  />
                </div>
                
                <Button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Next →
                </Button>
              </div>
            </div>
            
            {/* PDF Canvas */}
            <div className="flex-1 overflow-auto border border-gray-200 rounded bg-gray-50">
              <canvas
                ref={mobileCanvasRef}
                className="max-w-full h-auto"
                style={{ display: 'block', margin: '0 auto' }}
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
        <div className="fixed right-[22.5vw] top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 lg:block hidden">
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
      <div className="fixed right-4 top-4 bottom-4 w-[45vw] z-40 lg:block hidden">
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
                <p className="mt-2 text-sm text-gray-600">Loading PDF...</p>
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
          
          {!loading && !error && totalPages > 0 && (
            <>
              {/* Controls */}
              <div className="flex-shrink-0 mb-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Button
                      onClick={zoomOut}
                      size="sm"
                      variant="ghost"
                      className="text-xs px-2"
                    >
                      −
                    </Button>
                    <span className="text-xs text-gray-600">
                      {Math.round(scale * 100)}%
                    </span>
                    <Button
                      onClick={zoomIn}
                      size="sm"
                      variant="ghost"
                      className="text-xs px-2"
                    >
                      +
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    ← Prev
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                    />
                  </div>
                  
                  <Button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    Next →
                  </Button>
                </div>
              </div>
              
              {/* PDF Canvas */}
              <div className="flex-1 overflow-auto border border-gray-200 rounded bg-gray-50">
                <canvas
                  ref={desktopCanvasRef}
                  className="max-w-full h-auto"
                  style={{ display: 'block', margin: '0 auto' }}
                />
              </div>
              
              {/* File info */}
              {pdfDocs.length > 0 && (
                <div className="flex-shrink-0 mt-2 text-xs text-gray-500">
                  <div className="space-y-1">
                    {pdfDocs.map((docInfo, index) => {
                      const isCurrentFile = currentPage >= docInfo.startPage && 
                                          currentPage <= docInfo.startPage + docInfo.pageCount - 1;
                      return (
                        <div 
                          key={index}
                          className={`truncate ${isCurrentFile ? 'font-medium text-blue-600' : ''}`}
                        >
                          {docInfo.fileName} ({docInfo.pageCount} pages)
                        </div>
                      );
                    })}
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