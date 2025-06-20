import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFChunk, ChunkResult, mergeChunkResults } from './pdfProcessor';
import { PDFDocument } from 'pdf-lib';

// Polyfill for Promise.withResolvers if not available (Node.js < v22)
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

if (!process.env.GEMINI_KEYS) {
  throw new Error('Please add your GEMINI_KEYS to .env.local');
}

const keys = process.env.GEMINI_KEYS!.split(',');
let keyIndex = 0;

function getNextKey(): string {
  const key = keys[keyIndex];
  keyIndex = (keyIndex + 1) % keys.length;
  return key.trim();
}

export async function extractQuestionsFromPdf(buffer: Buffer | string, maxRetries: number = 3): Promise<any[]> {
  const maxAttempts = Math.min(keys.length, maxRetries);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const apiKey = getNextKey();
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `
You are given educational content that may include questions, explanations, and references to images or diagrams.

Your task is to extract or generate quiz questions (both single-choice and multiple-choice) from this content.

**IMPORTANT:**
- Only if you don't see any questions, then generate questions from the content. Else, extract the questions from the content.
- Only if you have to generate questions, then generate 10 questions. The generated questions **must be in the same language as the content.**
- The difficulty of the generated questions should be based on the content and has easy to medium difficulty.

Important Instructions:

1. **DO NOT OMIT ANY TEXT.** Even if the text refers to or is adjacent to an image (e.g., "In the diagram above", "Refer to the image", etc.), you must extract the full surrounding question text exactly as it appears.
2. **IGNORE IMAGES ENTIRELY.** Do not describe, summarize, or attempt to interpret any image content. Only process the visible text — even if it partially depends on an image.
3. **PRESERVE ALL CONTEXTUAL TEXT.** If a question is written around or near an image, still extract the full question text as-is. Do not skip it.
4. **NEVER DROP OR SKIP ANY QUESTION just because it involves an image.** Your job is to preserve every meaningful question or prompt in textual form.
5. Do not fabricate or modify content. Extract exact original wording where possible.
6. Reconstruct questions from visible text if they are implied or structured around diagrams or image references.
7. **REMOVE ANSWER CONTENT FROM QUESTIONS.** Ensure the extracted question text does *not* include any part of the answer options or explanatory answer content.
8. **STRIP ENUMERATION MARKERS.** When capturing options, delete any leading letters or numbers such as "a)", "A.", "1.", "(b)", "II.", etc., so each option contains only the core answer text.
9. Return ONLY a JSON array in the following format:

[
    {
        "question": "What is the capital of France?",
        "type": "single",
        "options": ["London", "Berlin", "Paris", "Madrid"],
        "correctIndex": 2
    },
    {
        "question": "Which of the following are programming languages?",
        "type": "multiple",
        "options": ["JavaScript", "HTML", "Python", "CSS"],
        "correctIndexes": [0, 2]
    }
]

Answer Formatting Rules:
- Use "type": "single" for one correct answer, with "correctIndex" 
- Use "type": "multiple" for multiple correct answers, with "correctIndexes" (array of indexes)
- Options must **not** contain any enumeration characters.
- No explanation, no extra output, only the JSON array
- Do NOT include any image fields (like questionImage or optionImages)

Be strict: **If any part of the text refers to a question or a labeled figure, extract the full question text regardless of image context.**
`;
      let result;
      
      if (typeof buffer === 'string') {
        // Handle URL case
        result = await model.generateContent([
          { text: prompt },
          { text: `Content: ${buffer}` }
        ]);
      } else {
        // Handle file buffer case
        const base64Data = buffer.toString('base64');
        result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
        ]);
      }

      const response = await result.response;
      const text = response.text();

      console.log('🤖 Gemini AI Response:', text);
      
      // Clean the response to extract JSON
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in response');
      }
      
      const questions = JSON.parse(jsonMatch[0]);
      
      // Validate the questions array basic shape
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions format');
      }

      const validQuestions: any[] = [];

      questions.forEach((q: any, i: number) => {
        const logPrefix = `Question ${i + 1}`;
        try {
          // Basic checks
          if (!q.question || !Array.isArray(q.options) || q.options.length < 2) {
            throw new Error('Missing text or options');
          }
          if (!q.type || !['single', 'multiple'].includes(q.type)) {
            throw new Error('Invalid type');
          }
          if (q.type === 'single') {
            if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
              throw new Error('Invalid correctIndex');
            }
          } else {
            if (!Array.isArray(q.correctIndexes) || q.correctIndexes.length === 0 || q.correctIndexes.some((idx: number) => idx < 0 || idx >= q.options.length)) {
              throw new Error('Invalid correctIndexes');
            }
          }
          validQuestions.push(q);
          console.log(`✅ ${logPrefix}: kept`);
        } catch (vErr) {
          console.warn(`⚠️ ${logPrefix}: dropped (${(vErr as Error).message})`);
        }
      });

      if (validQuestions.length === 0) {
        throw new Error('No valid questions in chunk');
      }

      return validQuestions;
      
    } catch (error: any) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      
      // If the error is about invalid JSON or format, do not retry further
      if (error.message?.includes('No valid JSON') || error.message?.includes('Invalid questions format')) {
        throw error;
      }
      
      if (attempt === maxAttempts - 1) {
        throw new Error(`Failed to extract questions after ${maxAttempts} attempts: ${error.message}`);
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('All retry attempts failed');
}

export async function generateQuizTitle(content: string): Promise<string> {
  try {
    const apiKey = getNextKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `
      Generate a concise, descriptive title for a quiz based on this content.
      The title should be:
      - 3-8 words long
      - Clear and specific
      - Suitable for students
      
      Content: ${content.substring(0, 500)}...
      
      Return only the title, no additional text.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    return 'Generated Quiz';
  }
}

/**
 * Process multiple PDF chunks in parallel using different Gemini keys
 */
export async function extractQuestionsFromPdfChunks(chunks: PDFChunk[]): Promise<any[]> {
  console.log(`🚀 Starting parallel processing of ${chunks.length} chunks`);
  const startTime = Date.now();
  
  try {
    // Process chunks in parallel, each with a different key
    const chunkPromises = chunks.map(async (chunk, index): Promise<ChunkResult> => {
      console.log(`📋 Processing chunk ${chunk.chunkIndex} (pages ${chunk.startPage}-${chunk.endPage}) with key rotation...`);
      
      try {
        const questions = await extractQuestionsFromPdf(chunk.buffer, 2);
        
        console.log(`✅ Chunk ${chunk.chunkIndex} completed: ${questions.length} questions extracted`);
        
        return {
          questions,
          chunkIndex: chunk.chunkIndex,
          startPage: chunk.startPage,
          endPage: chunk.endPage
        };
      } catch (error) {
        console.error(`❌ Chunk ${chunk.chunkIndex} failed:`, error);
        return {
          questions: [],
          chunkIndex: chunk.chunkIndex,
          startPage: chunk.startPage,
          endPage: chunk.endPage
        };
      }
    });
    
    // Wait for all chunks to complete
    const results = await Promise.all(chunkPromises);
    
    const processingTime = Date.now() - startTime;
    console.log(`🎯 Parallel processing completed in ${processingTime}ms`);
    
    // Merge results and remove duplicates
    const mergedQuestions = mergeChunkResults(results);
    
    console.log(`📊 Final result: ${mergedQuestions.length} unique questions from ${chunks.length} chunks`);
    
    return mergedQuestions;
    
  } catch (error) {
    console.error('❌ Error in parallel processing:', error);
    throw error;
  }
}

/**
 * Optimized extraction with automatic chunking for large PDFs
 */
export async function extractQuestionsFromPdfOptimized(
  buffer: Buffer, 
  forceParallel: boolean = false
): Promise<any[]> {
  const fileSize = buffer.length;
  const fileSizeMB = fileSize / (1024 * 1024);
  
  console.log(`📄 Processing PDF: ${fileSizeMB.toFixed(2)}MB`);
  
  // Use parallel processing for files > 0.8MB or when forcing
  // Since 1MB is already considered large, we start parallel at 0.8MB
  const shouldUseParallel = fileSizeMB > 0.8 || forceParallel;
  
  if (!shouldUseParallel) {
    console.log('📝 Using standard processing for small PDF');
    return extractQuestionsFromPdf(buffer);
  }
  
  // For larger files, try chunked parallel processing with fallback
  console.log('🚀 Attempting parallel chunked processing for PDF');
  
  try {
    const { splitPdfIntoChunks, calculateOptimalChunkSize } = await import('./pdfProcessor');
    
    // Get PDF page count using pdf-lib
    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();
    
    // Calculate optimal chunk parameters - more aggressive for smaller files
    const { chunkSize, overlapPages } = calculateOptimalChunkSize(fileSize, totalPages);
    
    // Split PDF into chunks
    const chunks = await splitPdfIntoChunks(buffer, chunkSize, overlapPages);
    
    if (chunks.length === 1) {
      console.log('📝 PDF too small to benefit from chunking, using standard processing');
      return extractQuestionsFromPdf(buffer);
    }
    
    // Process chunks in parallel
    return await extractQuestionsFromPdfChunks(chunks);
    
  } catch (error) {
    console.error('❌ Chunked processing failed, trying simplified parallel approach:', error);
    
    // Fallback: Try simple parallel processing with multiple API calls
    try {
      return await extractQuestionsWithSimpleParallel(buffer);
    } catch (fallbackError) {
      console.error('❌ Simplified parallel processing also failed, using standard processing:', fallbackError);
      // Final fallback to standard processing
      return extractQuestionsFromPdf(buffer);
    }
  }
}

/**
 * Simplified parallel processing without PDF chunking
 * Uses multiple API keys to process the same PDF with different prompts
 */
async function extractQuestionsWithSimpleParallel(buffer: Buffer): Promise<any[]> {
  console.log('🔄 Using simplified parallel processing with multiple API calls');
  
  const maxRetries = Math.min(keys.length, 2); 
  
  const promises = Array.from({ length: maxRetries }, async (_, index) => {
    try {
      console.log(`📋 Starting parallel extraction ${index + 1}/${maxRetries}`);
      const questions = await extractQuestionsFromPdf(buffer, 1);
      console.log(`✅ Parallel extraction ${index + 1} completed: ${questions.length} questions`);
      return questions;
    } catch (error) {
      console.error(`❌ Parallel extraction ${index + 1} failed:`, error);
      return [];
    }
  });
  
  const results = await Promise.all(promises);
  
  // Find the result with most questions
  const bestResult = results.reduce((best, current) => 
    current.length > best.length ? current : best, []
  );
  
  console.log(`📊 Simplified parallel processing completed. Best result: ${bestResult.length} questions`);
  
  return bestResult;
} 