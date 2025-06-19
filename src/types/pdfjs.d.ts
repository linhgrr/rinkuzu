declare module 'pdfjs-dist' {
  export interface GlobalWorkerOptions {
    workerSrc: string;
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface PDFPageProxy {
    getViewport(options: { scale: number }): PDFPageViewport;
    render(options: { canvasContext: CanvasRenderingContext2D; viewport: PDFPageViewport }): { promise: Promise<void> };
  }

  export interface PDFPageViewport {
    width: number;
    height: number;
  }

  export interface GetDocumentOptions {
    data: ArrayBuffer | Uint8Array;
  }

  export interface GetDocumentResult {
    promise: Promise<PDFDocumentProxy>;
  }

  export function getDocument(options: GetDocumentOptions): GetDocumentResult;
  export const GlobalWorkerOptions: GlobalWorkerOptions;
} 