// src/lib/gemini.ts
import { createLangChainModel, HumanMessage, getKeysCount } from './langchain';
import { PDFChunk, ChunkResult, mergeChunkResults } from './pdfProcessor';
import { PDFDocument } from 'pdf-lib';

// Polyfill for Promise.withResolvers if not available (Node.js < v22)
if (!(Promise as any).withResolvers) {
  (Promise as any).withResolvers = function () {
    let resolve: any, reject: any;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

const EXTRACTION_PROMPT = `
You are given educational content that may include questions, explanations, and references to images or diagrams.

Your task is to extract or generate quiz questions (both single-choice and multiple-choice) from this content.

**CRITICAL RULE – READ CAREFULLY:**
- Your FIRST and PRIMARY task is to **extract any and all questions** present in the content.
- **ONLY IF AND ONLY IF** there are absolutely **no extractable questions** in the content, then and only then you may generate new questions.
- DO NOT generate questions if even **one** question is already present — in that case, you must only extract.

**If you extract a question that expects a free-text or input-based answer** (e.g., "Nhập kết quả", "Điền vào chỗ trống", "What is the result of...?", etc.), then you MUST:
- Convert it into a **single-choice question** with exactly 4 plausible answer options.
- Ensure 1 is the correct answer, and 3 are incorrect but plausible distractors.

**If you generate questions (only when absolutely no extractable questions are present):**
- You must generate **exactly 10** questions.
- The questions must be based strictly on the ideas, facts, or definitions in the content — no outside knowledge.
- The questions must be in the **same language** as the original content.
- Difficulty should be easy to medium.

Important Instructions:

1. **DO NOT OMIT ANY TEXT.** Even if the text refers to or is adjacent to an image (e.g., "In the diagram above", "Refer to the image", etc.), you must extract the full surrounding question text exactly as it appears.
2. **IGNORE IMAGES ENTIRELY.** Do not describe, summarize, or attempt to interpret any image content. Only process the visible text — even if it partially depends on an image.
3. **PRESERVE ALL CONTEXTUAL TEXT.** If a question is written around or near an image, still extract the full question text as-is. Do not skip it.
4. **NEVER DROP OR SKIP ANY QUESTION just because it involves an image.** Your job is to preserve every meaningful question or prompt in textual form.
5. Do not fabricate or modify content. Extract exact original wording where possible.
6. Reconstruct questions from visible text if they are implied or structured around diagrams or image references.
7. **REMOVE ANSWER CONTENT FROM QUESTIONS.** Ensure the extracted question text does *not* include any part of the answer options or explanatory answer content.
8. **STRIP ENUMERATION MARKERS.** When capturing options, delete any leading letters or numbers such as "a)", "A.", "1.", "(b)", "II.", etc., so each option contains only the core answer text.

When generating (only if allowed):
- Focus only on clear facts, definitions, comparisons, or causal relationships in the content.
- Do not make assumptions or include anything not explicitly stated.
- All questions and answer choices must be plausible, unambiguous, and fully supported by the original text.

Return ONLY a JSON array in the following format:

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

**REMEMBER:** Generating questions is allowed **only if and only if** there are absolutely **no questions to extract** from the original text.
`;

/**
 * Extract questions from PDF using LangChain with retry logic
 */
export async function extractQuestionsFromPdf(
  buffer: Buffer | string,
  maxRetries: number = 3,
  signal?: AbortSignal
): Promise<any[]> {
  const maxAttempts = Math.min(getKeysCount(), maxRetries);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const model = createLangChainModel({ maxRetries: 1 });

      let messageContent: any[];

      if (typeof buffer === 'string') {
        // Handle URL/text case
        messageContent = [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'text', text: `Content: ${buffer}` }
        ];
      } else {
        // Handle PDF buffer case
        const base64Data = buffer.toString('base64');
        messageContent = [
          { type: 'text', text: EXTRACTION_PROMPT },
          {
            type: 'media',
            mimeType: 'application/pdf',
            data: base64Data,
          }
        ];
      }

      const message = new HumanMessage({ content: messageContent });
      const result = await model.invoke([message], { signal });

      const text = typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);

      console.log('🤖 LangChain AI Response:', text);

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

/**
 * Generate quiz title using LangChain
 */
export async function generateQuizTitle(content: string): Promise<string> {
  try {
    const model = createLangChainModel({ temperature: 0.7 });

    const prompt = `
      Generate a concise, descriptive title for a quiz based on this content.
      The title should be:
      - 3-8 words long
      - Clear and specific
      - Suitable for students

      Content: ${content.substring(0, 500)}...

      Return only the title, no additional text.
    `;

    const message = new HumanMessage(prompt);
    const result = await model.invoke([message]);

    return typeof result.content === 'string'
      ? result.content.trim()
      : 'Generated Quiz';
  } catch (error) {
    return 'Generated Quiz';
  }
}

/**
 * Process multiple PDF chunks SEQUENTIALLY (not parallel)
 */
export async function extractQuestionsFromPdfChunks(chunks: PDFChunk[]): Promise<any[]> {
  console.log(`🚀 Starting SEQUENTIAL processing of ${chunks.length} chunks`);
  const startTime = Date.now();

  const results: ChunkResult[] = [];

  // Process chunks one by one (sequential)
  for (const chunk of chunks) {
    console.log(`📋 Processing chunk ${chunk.chunkIndex} (pages ${chunk.startPage}-${chunk.endPage})...`);

    try {
      const questions = await extractQuestionsFromPdf(chunk.buffer, 2);

      console.log(`✅ Chunk ${chunk.chunkIndex} completed: ${questions.length} questions extracted`);

      results.push({
        questions,
        chunkIndex: chunk.chunkIndex,
        startPage: chunk.startPage,
        endPage: chunk.endPage
      });
    } catch (error) {
      console.error(`❌ Chunk ${chunk.chunkIndex} failed:`, error);
      results.push({
        questions: [],
        chunkIndex: chunk.chunkIndex,
        startPage: chunk.startPage,
        endPage: chunk.endPage
      });
    }

    // Small delay between chunks to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const processingTime = Date.now() - startTime;
  console.log(`🎯 Sequential processing completed in ${processingTime}ms`);

  // Merge results and remove duplicates
  const mergedQuestions = mergeChunkResults(results);

  console.log(`📊 Final result: ${mergedQuestions.length} unique questions from ${chunks.length} chunks`);

  return mergedQuestions;
}

/**
 * Optimized extraction with automatic chunking for large PDFs
 * Now uses SEQUENTIAL processing instead of parallel
 */
export async function extractQuestionsFromPdfOptimized(
  buffer: Buffer,
  forceChunking: boolean = false
): Promise<any[]> {
  const fileSize = buffer.length;
  const fileSizeMB = fileSize / (1024 * 1024);

  console.log(`📄 Processing PDF: ${fileSizeMB.toFixed(2)}MB`);

  // Use chunking for files > 0.8MB or when forcing
  const shouldUseChunking = fileSizeMB > 0.8 || forceChunking;

  if (!shouldUseChunking) {
    console.log('📝 Using standard processing for small PDF');
    return extractQuestionsFromPdf(buffer);
  }

  // For larger files, use chunked sequential processing
  console.log('🔄 Using chunked SEQUENTIAL processing for large PDF');

  try {
    const { splitPdfIntoChunks, calculateOptimalChunkSize } = await import('./pdfProcessor');

    // Get PDF page count using pdf-lib
    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();

    // Calculate optimal chunk parameters
    const { chunkSize, overlapPages } = calculateOptimalChunkSize(fileSize, totalPages);

    // Split PDF into chunks
    const chunks = await splitPdfIntoChunks(buffer, chunkSize, overlapPages);

    if (chunks.length === 1) {
      console.log('📝 PDF too small to benefit from chunking, using standard processing');
      return extractQuestionsFromPdf(buffer);
    }

    // Process chunks SEQUENTIALLY
    return await extractQuestionsFromPdfChunks(chunks);

  } catch (error) {
    console.error('❌ Chunked processing failed, falling back to standard processing:', error);
    // Fallback to standard processing
    return extractQuestionsFromPdf(buffer);
  }
}
