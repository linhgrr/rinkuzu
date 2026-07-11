'use client';

import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/features/quiz/components/PDFViewer'), { ssr: false });

interface DraftPdfPanelProps {
  pdfUrl: string;
  pdfDataUrl: string | null | undefined;
  onClose: () => void;
}

export function DraftPdfPanel({ pdfUrl, pdfDataUrl, onClose }: DraftPdfPanelProps) {
  return (
    <aside className="sticky top-0 h-screen w-1/2 border-l border-neutral-200 bg-white p-4">
      <PDFViewer
        pdfDataUrl={pdfDataUrl || null}
        pdfUrl={pdfUrl}
        onClose={onClose}
        showHeader={false}
      />
    </aside>
  );
}
