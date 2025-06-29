/**
 * Large File Upload Service with Parallel Processing
 * 
 * This service handles large PDF files by splitting them into manageable chunks
 * and processing them in parallel to improve performance.
 * 
 * Features:
 * - Automatic PDF splitting by pages with configurable chunk size
 * - Parallel processing with configurable concurrency limits
 * - Retry mechanism with exponential backoff
 * - Duplicate question detection and removal
 * - Real-time progress tracking
 * 
 * Usage:
 * ```typescript
 * const result = await extractQuestionsFromLargePDF(
 *   files,
 *   'Quiz Title',
 *   'Quiz Description',
 *   (progress) => console.log(progress),
 *   {
 *     maxConcurrentChunks: 5,  // Process 5 chunks simultaneously
 *     chunkSize: 10,           // 10 pages per chunk
 *     overlapPages: 2,         // 2 pages overlap between chunks
 *     maxRetries: 3            // Retry failed chunks 3 times
 *   }
 * )
 * ```
 */

import { Question } from '@/types/quiz'

export interface UploadProgress {
  currentChunk: number
  totalChunks: number
  currentFile: number
  totalFiles: number
  fileName: string
  status: 'uploading' | 'processing' | 'completed' | 'error'
  message: string
}

export interface ChunkResult {
  questions: Question[]
  chunkIndex: number
  fileName: string
  success: boolean
  error?: string
}

const CHUNK_SIZE = 4 // 4 pages per chunk
const OVERLAP_PAGES = 1 // 1 page overlap
const MAX_RETRIES = 3 // Maximum number of retries per chunk
const INITIAL_RETRY_DELAY = 1000 // Initial delay in ms
const RETRY_DELAY_MULTIPLIER = 2 // Multiply delay by this factor on each retry
const MAX_CONCURRENT_CHUNKS = 3 // Maximum number of chunks to process in parallel

export interface ParallelProcessingOptions {
  maxConcurrentChunks?: number
  chunkSize?: number
  overlapPages?: number
  maxRetries?: number
}

/**
 * Sleep function for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Split PDF into chunks by pages using pdf-lib
 */
async function splitPdfIntoPageChunks(file: File, chunkSize: number, overlapPages: number): Promise<{ chunks: Blob[], pageRanges: { start: number, end: number }[] }> {
  try {
    // Dynamic import for pdf-lib
    const { PDFDocument } = await import('pdf-lib')
    
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const totalPages = pdfDoc.getPageCount()
    
    console.log(`📄 PDF has ${totalPages} pages, splitting into chunks of ${chunkSize} with ${overlapPages} overlap`)
    
    const chunks: Blob[] = []
    const pageRanges: { start: number, end: number }[] = []
    
    // If PDF is small, don't split
    if (totalPages <= chunkSize) {
      const chunk = new Blob([arrayBuffer], { type: 'application/pdf' })
      chunks.push(chunk)
      pageRanges.push({ start: 1, end: totalPages })
      return { chunks, pageRanges }
    }
    
    // Create overlapping chunks by pages
    let startPage = 1
    let chunkIndex = 0
    
    while (startPage <= totalPages) {
      const endPage = Math.min(startPage + chunkSize - 1, totalPages)
      
      // Create new PDF with selected pages
      const newPdf = await PDFDocument.create()
      
      // Copy pages (PDF pages are 0-indexed but our input is 1-indexed)
      for (let i = startPage - 1; i < endPage; i++) {
        if (i < pdfDoc.getPageCount()) {
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [i])
          newPdf.addPage(copiedPage)
        }
      }
      
      const newPdfBytes = await newPdf.save()
      const chunk = new Blob([newPdfBytes], { type: 'application/pdf' })
      
      chunks.push(chunk)
      pageRanges.push({ start: startPage, end: endPage })
      
      console.log(`📋 Created chunk ${chunkIndex + 1}: pages ${startPage}-${endPage}`)
      
      // Move to next chunk with overlap
      startPage = endPage - overlapPages + 1
      chunkIndex++
      
      // Break if we've reached the end
      if (endPage >= totalPages) break
    }
    
    return { chunks, pageRanges }
    
  } catch (error) {
    console.error('❌ Error splitting PDF by pages:', error)
    throw new Error(`Failed to split PDF by pages: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create a hash for a question to detect duplicates
 */
function createQuestionHash(question: Question): string {
  // Create a normalized version of the question for hashing
  const normalizedQuestion = {
    question: question.question.trim().toLowerCase(),
    options: question.options.map(opt => opt.trim().toLowerCase()).sort(),
    type: question.type
  }
  
  // Simple hash function
  const str = JSON.stringify(normalizedQuestion)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return hash.toString()
}

/**
 * Create FormData for a single chunk
 */
function createChunkFormData(
  chunk: Blob, 
  chunkIndex: number, 
  totalChunks: number,
  fileName: string,
  title: string,
  description: string,
  pageRange: { start: number, end: number }
): FormData {
  const formData = new FormData()
  
  // Create a new File object from the chunk with proper name
  const chunkFile = new File([chunk], `${fileName}_chunk_${chunkIndex + 1}_pages_${pageRange.start}-${pageRange.end}.pdf`, {
    type: 'application/pdf'
  })
  
  formData.append('pdfFile_0', chunkFile)
  formData.append('fileCount', '1')
  formData.append('title', title)
  formData.append('description', description)
  formData.append('chunkIndex', chunkIndex.toString())
  formData.append('totalChunks', totalChunks.toString())
  formData.append('originalFileName', fileName)
  formData.append('pageRange', JSON.stringify(pageRange))
  
  return formData
}

/**
 * Upload a single chunk with retry mechanism
 */
async function uploadChunkWithRetry(
  formData: FormData,
  onProgress?: (progress: UploadProgress) => void,
  maxRetries: number = MAX_RETRIES
): Promise<ChunkResult> {
  const chunkIndex = parseInt(formData.get('chunkIndex') as string)
  const fileName = formData.get('originalFileName') as string
  const pageRange = JSON.parse(formData.get('pageRange') as string)
  
  let lastError: string = ''
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      onProgress?.({
        currentChunk: chunkIndex + 1,
        totalChunks: parseInt(formData.get('totalChunks') as string),
        currentFile: 1,
        totalFiles: 1,
        fileName,
        status: attempt === 0 ? 'uploading' : 'processing',
        message: attempt === 0 
          ? `Uploading chunk ${chunkIndex + 1} (pages ${pageRange.start}-${pageRange.end})...`
          : `Retrying chunk ${chunkIndex + 1} (attempt ${attempt + 1}/${maxRetries + 1})...`
      })

      const response = await fetch('/api/quizzes/preview', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(300000), // 5 minutes timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to extract questions from chunk')
      }

      onProgress?.({
        currentChunk: chunkIndex + 1,
        totalChunks: parseInt(formData.get('totalChunks') as string),
        currentFile: 1,
        totalFiles: 1,
        fileName,
        status: 'processing',
        message: `Processing chunk ${chunkIndex + 1} (pages ${pageRange.start}-${pageRange.end})...`
      })

      // Process questions to ensure correct format
      const processedQuestions = data.data.questions.map((q: any) => {
        const questionType = q.type || 'single'
        let processedQuestion: Question = {
          question: q.question,
          options: q.options,
          type: questionType
        }

        if (questionType === 'single') {
          let finalCorrectAnswer = q.correctAnswer
          
          if (typeof finalCorrectAnswer === 'undefined') {
            if (typeof q.correctIndex === 'number') {
              finalCorrectAnswer = q.correctIndex
            } else if (typeof q.originalCorrectIndex === 'number') {
              finalCorrectAnswer = q.originalCorrectIndex
            } else {
              finalCorrectAnswer = 0
            }
          }
          
          processedQuestion.correctIndex = finalCorrectAnswer
        } else {
          processedQuestion.correctIndexes = q.correctIndexes || q.correctAnswers || []
        }

        return processedQuestion
      })

      console.log(`✅ Chunk ${chunkIndex + 1} (pages ${pageRange.start}-${pageRange.end}) processed successfully`)
      
      return {
        questions: processedQuestions,
        chunkIndex,
        fileName,
        success: true
      }

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      
      if (attempt < maxRetries) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(RETRY_DELAY_MULTIPLIER, attempt)
        console.warn(`⚠️ Chunk ${chunkIndex + 1} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError}. Retrying in ${delay}ms...`)
        
        onProgress?.({
          currentChunk: chunkIndex + 1,
          totalChunks: parseInt(formData.get('totalChunks') as string),
          currentFile: 1,
          totalFiles: 1,
          fileName,
          status: 'error',
          message: `Chunk ${chunkIndex + 1} failed, retrying in ${delay/1000}s... (${lastError})`
        })
        
        await sleep(delay)
      } else {
        console.error(`❌ Chunk ${chunkIndex + 1} failed after ${maxRetries + 1} attempts: ${lastError}`)
      }
    }
  }

  return {
    questions: [],
    chunkIndex,
    fileName,
    success: false,
    error: `Failed after ${maxRetries + 1} attempts: ${lastError}`
  }
}

/**
 * Merge questions from multiple chunks, removing duplicates using hash
 */
function mergeQuestionsFromChunks(chunkResults: ChunkResult[]): Question[] {
  const allQuestions: Question[] = []
  const seenHashes = new Set<string>()

  // Sort by chunk index to maintain order
  const sortedResults = chunkResults
    .filter(result => result.success)
    .sort((a, b) => a.chunkIndex - b.chunkIndex)

  console.log(`🔄 Merging ${sortedResults.length} chunks with duplicate removal...`)

  for (const result of sortedResults) {
    console.log(`📋 Processing chunk ${result.chunkIndex + 1}: ${result.questions.length} questions`)
    
    for (const question of result.questions) {
      const questionHash = createQuestionHash(question)
      
      if (!seenHashes.has(questionHash)) {
        seenHashes.add(questionHash)
        allQuestions.push(question)
        console.log(`✅ Added question: "${question.question.substring(0, 50)}..."`)
      } else {
        console.log(`🚫 Skipped duplicate: "${question.question.substring(0, 50)}..."`)
      }
    }
  }

  console.log(`🎯 Final result: ${allQuestions.length} unique questions from ${sortedResults.length} chunks`)
  return allQuestions
}

/**
 * Process chunks in parallel with concurrency control
 */
async function processChunksInParallel(
  chunks: Blob[],
  pageRanges: { start: number, end: number }[],
  fileName: string,
  title: string,
  description: string,
  onProgress?: (progress: UploadProgress) => void,
  maxConcurrentChunks: number = MAX_CONCURRENT_CHUNKS,
  maxRetries: number = MAX_RETRIES
): Promise<ChunkResult[]> {
  const results: ChunkResult[] = []
  const activePromises = new Set<Promise<void>>()
  let completedChunks = 0
  let successfulChunks = 0
  let failedChunks = 0
  
  console.log(`🚀 Starting parallel processing of ${chunks.length} chunks with max ${maxConcurrentChunks} concurrent`)
  
  onProgress?.({
    currentChunk: 0,
    totalChunks: chunks.length,
    currentFile: 1,
    totalFiles: 1,
    fileName,
    status: 'uploading',
    message: `Starting parallel processing of ${chunks.length} chunks (max ${maxConcurrentChunks} concurrent)...`
  })
  
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    // Wait if we've reached the concurrency limit
    while (activePromises.size >= maxConcurrentChunks) {
      await Promise.race(activePromises)
    }
    
    const chunk = chunks[chunkIndex]
    const pageRange = pageRanges[chunkIndex]
    
    const formData = createChunkFormData(
      chunk,
      chunkIndex,
      chunks.length,
      fileName,
      title,
      description,
      pageRange
    )
    
    // Create promise for this chunk
    const chunkPromise = (async () => {
      try {
        const result = await uploadChunkWithRetry(formData, (progress) => {
          // Update progress for individual chunk
          onProgress?.({
            ...progress,
            currentChunk: completedChunks + 1,
            totalChunks: chunks.length,
            message: `${progress.message} (${completedChunks + 1}/${chunks.length} chunks)`
          })
        }, maxRetries)
        results[chunkIndex] = result
        
        completedChunks++
        if (result.success) {
          successfulChunks++
        } else {
          failedChunks++
        }
        
        onProgress?.({
          currentChunk: completedChunks,
          totalChunks: chunks.length,
          currentFile: 1,
          totalFiles: 1,
          fileName,
          status: 'processing',
          message: `Completed ${completedChunks}/${chunks.length} chunks (${successfulChunks} success, ${failedChunks} failed)`
        })
      } catch (error) {
        console.error(`❌ Unexpected error processing chunk ${chunkIndex + 1}:`, error)
        results[chunkIndex] = {
          questions: [],
          chunkIndex,
          fileName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        completedChunks++
        failedChunks++
      }
    })()
    
    activePromises.add(chunkPromise)
    
    // Remove promise from set when it completes
    chunkPromise.finally(() => {
      activePromises.delete(chunkPromise)
    })
  }
  
  // Wait for all remaining promises to complete
  await Promise.all(activePromises)
  
  console.log(`✅ All ${chunks.length} chunks processed in parallel: ${successfulChunks} success, ${failedChunks} failed`)
  return results
}

/**
 * Upload large files by splitting them into page-based chunks and processing in parallel
 */
export async function extractQuestionsFromLargePDF(
  files: File[],
  title: string,
  description: string,
  onProgress?: (progress: UploadProgress) => void,
  options?: ParallelProcessingOptions
): Promise<{
  title: string
  description: string
  questions: Question[]
  fileNames: string[]
}> {
  // Use provided options or defaults
  const config = {
    maxConcurrentChunks: options?.maxConcurrentChunks ?? MAX_CONCURRENT_CHUNKS,
    chunkSize: options?.chunkSize ?? CHUNK_SIZE,
    overlapPages: options?.overlapPages ?? OVERLAP_PAGES,
    maxRetries: options?.maxRetries ?? MAX_RETRIES
  }
  
  console.log(`⚙️ Processing configuration:`, config)
  
  const allQuestions: Question[] = []
  const fileNames: string[] = []

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex]
    const fileName = file.name
    
    onProgress?.({
      currentChunk: 0,
      totalChunks: 0,
      currentFile: fileIndex + 1,
      totalFiles: files.length,
      fileName,
      status: 'uploading',
      message: `Processing file ${fileIndex + 1}/${files.length}: ${fileName}`
    })

    // Check if file needs to be split (larger than 4MB)
    if (file.size <= 4 * 1024 * 1024) {
      // Small file, process normally with retry
      const formData = new FormData()
      formData.append('pdfFile_0', file)
      formData.append('fileCount', '1')
      formData.append('title', title)
      formData.append('description', description)

      const result = await uploadChunkWithRetry(formData, onProgress, config.maxRetries)
      
      if (result.success) {
        allQuestions.push(...result.questions)
        fileNames.push(fileName)
      } else {
        // For small files, if it fails completely, throw error
        throw new Error(`Failed to process ${fileName}: ${result.error}`)
      }
    } else {
      // Large file, split into page-based chunks
      onProgress?.({
        currentChunk: 0,
        totalChunks: 0,
        currentFile: fileIndex + 1,
        totalFiles: files.length,
        fileName,
        status: 'uploading',
        message: `Splitting ${fileName} into page-based chunks...`
      })

      const { chunks, pageRanges } = await splitPdfIntoPageChunks(file, config.chunkSize, config.overlapPages)
      
      onProgress?.({
        currentChunk: 0,
        totalChunks: chunks.length,
        currentFile: fileIndex + 1,
        totalFiles: files.length,
        fileName,
        status: 'uploading',
        message: `Created ${chunks.length} chunks for ${fileName}`
      })

      const chunkResults = await processChunksInParallel(
        chunks,
        pageRanges,
        fileName,
        title,
        description,
        onProgress,
        config.maxConcurrentChunks,
        config.maxRetries
      )

      // Check if all chunks were successful
      const failedChunks = chunkResults.filter(result => !result.success)
      if (failedChunks.length > 0) {
        // Log failed chunks but continue if we have some successful chunks
        const errorMessages = failedChunks.map(result => 
          `Chunk ${result.chunkIndex + 1}: ${result.error}`
        ).join('; ')
        
        console.warn(`⚠️ ${failedChunks.length} chunks failed: ${errorMessages}`)
        
        // Only throw error if ALL chunks failed
        if (failedChunks.length === chunkResults.length) {
          throw new Error(`Failed to process ${fileName}: All chunks failed. ${errorMessages}`)
        } else {
          console.log(`✅ Continuing with ${chunkResults.length - failedChunks.length} successful chunks`)
        }
      }

      // Merge questions from all successful chunks with duplicate removal
      const successfulChunks = chunkResults.filter(result => result.success)
      const mergedQuestions = mergeQuestionsFromChunks(successfulChunks)
      allQuestions.push(...mergedQuestions)
      fileNames.push(fileName)

      onProgress?.({
        currentChunk: chunks.length,
        totalChunks: chunks.length,
        currentFile: fileIndex + 1,
        totalFiles: files.length,
        fileName,
        status: 'completed',
        message: `Completed processing ${fileName} (${mergedQuestions.length} unique questions extracted${failedChunks.length > 0 ? `, ${failedChunks.length} chunks skipped` : ''})`
      })
    }
  }

  onProgress?.({
    currentChunk: 0,
    totalChunks: 0,
    currentFile: files.length,
    totalFiles: files.length,
    fileName: '',
    status: 'completed',
    message: `All files processed successfully (${allQuestions.length} total unique questions)`
  })

  return {
    title,
    description,
    questions: allQuestions,
    fileNames
  }
} 