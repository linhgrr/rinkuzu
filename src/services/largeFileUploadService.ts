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

const CHUNK_SIZE = 5 // 5 pages per chunk
const OVERLAP_PAGES = 1 // 1 page overlap
const MAX_RETRIES = 3 // Maximum number of retries per chunk
const INITIAL_RETRY_DELAY = 1000 // Initial delay in ms
const RETRY_DELAY_MULTIPLIER = 2 // Multiply delay by this factor on each retry

/**
 * Sleep function for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Split PDF into chunks by pages using pdf-lib
 */
async function splitPdfIntoPageChunks(file: File): Promise<{ chunks: Blob[], pageRanges: { start: number, end: number }[] }> {
  try {
    // Dynamic import for pdf-lib
    const { PDFDocument } = await import('pdf-lib')
    
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const totalPages = pdfDoc.getPageCount()
    
    console.log(`📄 PDF has ${totalPages} pages, splitting into chunks of ${CHUNK_SIZE} with ${OVERLAP_PAGES} overlap`)
    
    const chunks: Blob[] = []
    const pageRanges: { start: number, end: number }[] = []
    
    // If PDF is small, don't split
    if (totalPages <= CHUNK_SIZE) {
      const chunk = new Blob([arrayBuffer], { type: 'application/pdf' })
      chunks.push(chunk)
      pageRanges.push({ start: 1, end: totalPages })
      return { chunks, pageRanges }
    }
    
    // Create overlapping chunks by pages
    let startPage = 1
    let chunkIndex = 0
    
    while (startPage <= totalPages) {
      const endPage = Math.min(startPage + CHUNK_SIZE - 1, totalPages)
      
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
      startPage = endPage - OVERLAP_PAGES + 1
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
  onProgress?: (progress: UploadProgress) => void
): Promise<ChunkResult> {
  const chunkIndex = parseInt(formData.get('chunkIndex') as string)
  const fileName = formData.get('originalFileName') as string
  const pageRange = JSON.parse(formData.get('pageRange') as string)
  
  let lastError: string = ''
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
          : `Retrying chunk ${chunkIndex + 1} (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`
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
      
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(RETRY_DELAY_MULTIPLIER, attempt)
        console.warn(`⚠️ Chunk ${chunkIndex + 1} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError}. Retrying in ${delay}ms...`)
        
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
        console.error(`❌ Chunk ${chunkIndex + 1} failed after ${MAX_RETRIES + 1} attempts: ${lastError}`)
      }
    }
  }

  return {
    questions: [],
    chunkIndex,
    fileName,
    success: false,
    error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastError}`
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
 * Upload large files by splitting them into page-based chunks and processing sequentially
 */
export async function extractQuestionsFromLargePDF(
  files: File[],
  title: string,
  description: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{
  title: string
  description: string
  questions: Question[]
  fileNames: string[]
}> {
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

      const result = await uploadChunkWithRetry(formData, onProgress)
      
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

      const { chunks, pageRanges } = await splitPdfIntoPageChunks(file)
      
      onProgress?.({
        currentChunk: 0,
        totalChunks: chunks.length,
        currentFile: fileIndex + 1,
        totalFiles: files.length,
        fileName,
        status: 'uploading',
        message: `Created ${chunks.length} chunks for ${fileName}`
      })

      const chunkResults: ChunkResult[] = []

      // Process chunks sequentially to avoid overwhelming the server
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
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

        const result = await uploadChunkWithRetry(formData, onProgress)
        chunkResults.push(result)

        // Add small delay between chunks to be nice to the server
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

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