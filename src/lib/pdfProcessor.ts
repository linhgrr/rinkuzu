// PDF processing utilities for parallel extraction

import { PDFDocument } from 'pdf-lib';

if (!(Promise as any).withResolvers) {
  (Promise as any).withResolvers = function() {
    let resolve: any, reject: any;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export interface PDFChunk {
  buffer: Buffer;
  startPage: number;
  endPage: number;
  totalPages: number;
  chunkIndex: number;
}

export interface ChunkResult {
  questions: any[];
  chunkIndex: number;
  startPage: number;
  endPage: number;
}

/**
 * Split PDF into overlapping chunks for parallel processing
 */
export async function splitPdfIntoChunks(
  pdfBuffer: Buffer, 
  chunkSize: number = 5,
  overlapPages: number = 1
): Promise<PDFChunk[]> {
  try {
    // Load PDF document using pdf-lib for page counting
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const totalPages = pdfDoc.getPageCount();
    const chunks: PDFChunk[] = [];
    
    console.log(`📄 Total pages: ${totalPages}, splitting into chunks of ${chunkSize} with ${overlapPages} overlap`);

    // If PDF is small, don't split
    if (totalPages <= chunkSize) {
      chunks.push({
        buffer: pdfBuffer,
        startPage: 1,
        endPage: totalPages,
        totalPages,
        chunkIndex: 0
      });
      return chunks;
    }

    // Create overlapping chunks
    let chunkIndex = 0;
    for (let start = 1; start <= totalPages; start += chunkSize - overlapPages) {
      const end = Math.min(start + chunkSize - 1, totalPages);
      
      // Extract pages for this chunk
      const chunkBuffer = await extractPagesFromPdf(pdfDoc, start, end);
      
      chunks.push({
        buffer: chunkBuffer,
        startPage: start,
        endPage: end,
        totalPages,
        chunkIndex: chunkIndex++
      });
      
      console.log(`📋 Created chunk ${chunkIndex}: pages ${start}-${end}`);
      
      // Break if we've reached the end
      if (end >= totalPages) break;
    }

    return chunks;
    
  } catch (error) {
    console.error('❌ Error splitting PDF:', error);
    throw new Error(`Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract specific pages from PDF document and return as buffer
 */
async function extractPagesFromPdf(
  pdfDoc: PDFDocument, 
  startPage: number, 
  endPage: number
): Promise<Buffer> {
  try {
    // Create new PDF with selected pages
    const newPdf = await PDFDocument.create();
    
    // Copy pages (PDF pages are 0-indexed but our input is 1-indexed)
    for (let i = startPage - 1; i < endPage; i++) {
      if (i < pdfDoc.getPageCount()) {
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
      }
    }
    
    const newPdfBytes = await newPdf.save();
    return Buffer.from(newPdfBytes);
    
  } catch (error) {
    console.error(`❌ Error extracting pages ${startPage}-${endPage}:`, error);
    throw error;
  }
}

/**
 * Merge results from multiple chunks, removing duplicates
 */
export function mergeChunkResults(chunkResults: ChunkResult[]): any[] {
  const allQuestions: any[] = [];
  const questionTexts = new Set<string>();
  
  // Sort results by chunk index to maintain order
  chunkResults.sort((a, b) => a.chunkIndex - b.chunkIndex);
  
  for (const result of chunkResults) {
    console.log(`🔄 Processing chunk ${result.chunkIndex} (pages ${result.startPage}-${result.endPage}): ${result.questions.length} questions`);
    
    for (const question of result.questions) {
      // Create a hash of the question to detect duplicates
      const questionHash = createQuestionHash(question);
      
      if (!questionTexts.has(questionHash)) {
        questionTexts.add(questionHash);
        allQuestions.push({
          ...question,
          sourceChunk: result.chunkIndex,
          sourcePages: `${result.startPage}-${result.endPage}`
        });
        console.log(`✅ Added unique question: ${question.question?.substring(0, 50)}...`);
      } else {
        console.log(`🔄 Skipped duplicate question: ${question.question?.substring(0, 50)}...`);
      }
    }
  }
  
  console.log(`📊 Total unique questions after merging: ${allQuestions.length}`);
  // Extra pass: ensure no near-duplicate consecutive questions (edge case)
  const finalQuestions: any[] = [];
  let lastHash = '';
  for (const q of allQuestions) {
    const currentHash = createQuestionHash(q);
    if (currentHash !== lastHash) {
      finalQuestions.push(q);
      lastHash = currentHash;
    } else {
      console.warn(`⚠️ Removed consecutive duplicate question: ${q.question?.substring(0, 50)}...`);
    }
  }
  console.log(`📊 Final question count after duplicate pass: ${finalQuestions.length}`);
  return finalQuestions;
}

/**
 * Create a hash of question content to detect duplicates
 */
function createQuestionHash(question: any): string {
  const normalizedQuestion = question.question?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
  const normalizedOptions = question.options?.map((opt: string) => 
    opt.toLowerCase().trim().replace(/\s+/g, ' ')
  ).join('|') || '';
  
  return `${normalizedQuestion}:::${normalizedOptions}`;
}

/**
 * Estimate optimal chunk size based on PDF size and content density
 * Optimized for very small PDFs where 1MB is already considered large
 */
export function calculateOptimalChunkSize(pdfSizeBytes: number, totalPages: number): {
  chunkSize: number;
  overlapPages: number;
} {
  // Always use fixed strategy: 10 pages per chunk with 1 page overlap
  const fixedChunkSize = 10;
  const overlapPages = 1;

  // If total pages less than fixed chunk size, just return total pages without overlap
  if (totalPages <= fixedChunkSize) {
    return {
      chunkSize: totalPages,
      overlapPages: 0
    };
  }

  console.log(`📐 Fixed chunking strategy: ${fixedChunkSize} pages per chunk with ${overlapPages} overlap`);

  return {
    chunkSize: fixedChunkSize,
    overlapPages
  };
} 