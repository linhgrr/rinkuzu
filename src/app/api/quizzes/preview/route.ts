import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { extractQuestionsFromPdf, extractQuestionsFromPdfOptimized } from '@/lib/gemini';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

// Route segment config for handling large files
export const maxDuration = 300; // 5 minutes timeout
export const dynamic = 'force-dynamic';

// Function to remove duplicate questions using hash
function removeDuplicateQuestions(questions: any[]) {
  const seenHashes = new Set<string>();
  const uniqueQuestions: any[] = [];
  const duplicates: any[] = [];

  console.log(`🔍 Checking for duplicates in ${questions.length} questions...`);

  questions.forEach((question, index) => {
    // Create a normalized hash based on question text and options
    const questionText = question.question?.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
    const normalizedOptions = question.options?.map((opt: string) => 
      opt?.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '')
    ).sort();
    
    const questionData = {
      question: questionText,
      options: normalizedOptions
    };
    
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(questionData))
      .digest('hex');

    if (seenHashes.has(hash)) {
      console.log(`🔍 Found duplicate question ${index + 1}: "${question.question?.substring(0, 50)}..."`);
      duplicates.push({
        index: index + 1,
        question: question.question?.substring(0, 100),
        hash: hash.substring(0, 8),
        originalIndex: question.originalIndex || index + 1
      });
    } else {
      seenHashes.add(hash);
      uniqueQuestions.push({
        ...question,
        originalIndex: index + 1,
        uniqueHash: hash.substring(0, 8) // Include short hash for debugging
      });
    }
  });

  console.log(`✅ Duplicate check complete: ${uniqueQuestions.length} unique, ${duplicates.length} duplicates removed`);
  
  if (duplicates.length > 0) {
    console.log(`🗑️ Removed duplicates:`, duplicates.map(d => `Q${d.index}: ${d.question}...`));
  }

  return {
    uniqueQuestions,
    duplicatesRemoved: duplicates.length,
    duplicateDetails: duplicates
  };
}

// POST /api/quizzes/preview - Extract questions from PDF and return preview
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const fileCount = parseInt(formData.get('fileCount') as string) || 0;

    if (!title || fileCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Title and at least one PDF file are required' },
        { status: 400 }
      );
    }

    // Get all PDF files
    const pdfFiles: File[] = [];
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`pdfFile_${i}`) as File;
      if (file) {
        pdfFiles.push(file);
      }
    }

    // Validate file types and sizes
    for (const file of pdfFiles) {
      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { success: false, error: `File "${file.name}" is not a PDF file` },
          { status: 400 }
        );
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        return NextResponse.json(
          { success: false, error: `File "${file.name}" size must be less than 50MB` },
          { status: 400 }
        );
      }
    }

    // Extract questions from all PDF files using optimized processing
    let allQuestions: any[] = [];
    let totalFileSize = 0;
    const fileNames: string[] = [];
    const processingStartTime = Date.now();

    // Process files in parallel if we have multiple files
    if (pdfFiles.length > 1) {
      console.log(`🚀 Processing ${pdfFiles.length} files in parallel...`);
      
      const filePromises = pdfFiles.map(async (file, index) => {
        console.log(`📄 Processing file ${index + 1}/${pdfFiles.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        const buffer = Buffer.from(await file.arrayBuffer());
        
        try {
          // Use optimized processing for each file
          const fileQuestions = await extractQuestionsFromPdfOptimized(buffer, false);
          
          console.log(`✅ File ${file.name}: ${fileQuestions.length} questions extracted`);
          
          return {
            questions: fileQuestions,
            fileName: file.name,
            fileSize: file.size
          };
        } catch (error) {
          console.error(`❌ Failed to process ${file.name}:`, error);
          return {
            questions: [],
            fileName: file.name,
            fileSize: file.size
          };
        }
      });
      
      const results = await Promise.all(filePromises);
      
      // Combine results
      for (const result of results) {
        allQuestions = allQuestions.concat(result.questions);
        totalFileSize += result.fileSize;
        fileNames.push(result.fileName);
      }
      
    } else {
      // Single file processing
      const file = pdfFiles[0];
      console.log(`📄 Processing single file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Use optimized processing
      const fileQuestions = await extractQuestionsFromPdfOptimized(buffer, false);
      
      if (fileQuestions && fileQuestions.length > 0) {
        allQuestions = fileQuestions;
        console.log(`✅ Extracted ${fileQuestions.length} questions from ${file.name}`);
      } else {
        console.log(`⚠️ No questions extracted from ${file.name}`);
      }
      
      totalFileSize = file.size;
      fileNames.push(file.name);
    }

    const processingTime = Date.now() - processingStartTime;
    console.log(`🎯 Total processing time: ${processingTime}ms for ${pdfFiles.length} file(s)`);

    const rawQuestions = allQuestions;

    // Log the raw questions data for debugging
    console.log('📋 Raw questions from Gemini:', JSON.stringify(rawQuestions.slice(0, 2), null, 2)); // Log first 2 questions only
    console.log('📊 Questions count:', rawQuestions?.length || 0);

    if (!rawQuestions || rawQuestions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not extract questions from PDF(s). The files may not contain recognizable question content.' },
        { status: 400 }
      );
    }

    // Convert Gemini format to frontend format
    const questions = rawQuestions.map((q, index) => {
      console.log(`🔄 Converting Question ${index + 1}:`, {
        hasQuestion: !!q.question,
        type: q.type,
        correctIndex: q.correctIndex,
        correctIndexes: q.correctIndexes,
        sourceChunk: q.sourceChunk,
        sourcePages: q.sourcePages
      });

      let correctAnswer;
      
      // Check if correctIndex exists directly (regardless of type)
      if (typeof q.correctIndex === 'number' && q.correctIndex >= 0) {
        correctAnswer = q.correctIndex;
        console.log(`✅ Found correctIndex: ${correctAnswer}`);
      } else if (Array.isArray(q.correctIndexes) && q.correctIndexes.length > 0) {
        // For multiple choice, use the first correct answer
        correctAnswer = q.correctIndexes[0];
        console.log(`✅ Found correctIndexes, using first: ${correctAnswer}`);
      } else {
        console.warn(`⚠️ Question ${index + 1}: No valid correct answer found, defaulting to 0`);
        correctAnswer = 0; // Default to first option
      }

      const converted = {
        question: q.question,
        options: q.options,
        correctAnswer: correctAnswer,
        type: q.type || 'single', // Default to single if type missing
        correctIndex: q.type === 'single' ? (q.correctIndex ?? correctAnswer) : undefined,
        correctIndexes: q.type === 'multiple' ? q.correctIndexes : undefined,
        originalCorrectIndex: q.correctIndex,
        originalCorrectIndexes: q.correctIndexes,
        // Include processing metadata
        sourceChunk: q.sourceChunk,
        sourcePages: q.sourcePages
      };

      return converted;
    });

    console.log('🔄 Converting questions to frontend format...');
    console.log(`📊 Raw questions count: ${questions.length}`);

    // Remove duplicates from the questions
    const { uniqueQuestions, duplicatesRemoved, duplicateDetails } = removeDuplicateQuestions(questions);

    console.log('🎯 Final processing complete:');
    console.log(`  📊 Total questions processed: ${questions.length}`);
    console.log(`  ✅ Unique questions: ${uniqueQuestions.length}`);
    console.log(`  🗑️ Duplicates removed: ${duplicatesRemoved}`);
    console.log(`  ⏱️ Processing time: ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      data: {
        title,
        description,
        questions: uniqueQuestions,
        originalFileName: fileNames.join(', '),
        fileSize: totalFileSize,
        fileCount: pdfFiles.length,
        fileNames: fileNames,
        processingTime: processingTime,
        processingMethod: pdfFiles.length > 1 ? 'parallel-files' : (totalFileSize > 0.8 * 1024 * 1024 ? 'parallel-chunks' : 'standard'),
        duplicatesInfo: {
          duplicatesRemoved,
          duplicateDetails: duplicateDetails.slice(0, 5) // Only include first 5 duplicate details to avoid large response
        },
        statistics: {
          originalCount: questions.length,
          uniqueCount: uniqueQuestions.length,
          duplicatesRemoved,
          processingTimeMs: processingTime
        }
      }
    });

  } catch (error: any) {
    console.error('Preview quiz error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}