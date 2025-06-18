import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { extractQuestionsFromPdf } from '@/lib/gemini';
import { authOptions } from '@/lib/auth';

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
    const pdfFile = formData.get('pdfFile') as File;

    if (!title || !pdfFile) {
      return NextResponse.json(
        { success: false, error: 'Title and PDF file are required' },
        { status: 400 }
      );
    }

    // Validate file type and size
    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    if (pdfFile.size > 20 * 1024 * 1024) { // 20MB limit
      return NextResponse.json(
        { success: false, error: 'File size must be less than 20MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer for Gemini API
    const buffer = Buffer.from(await pdfFile.arrayBuffer());

    // Extract questions using Gemini AI
    const rawQuestions = await extractQuestionsFromPdf(buffer);

    // Log the raw questions data for debugging
    console.log('📋 Raw questions from Gemini:', JSON.stringify(rawQuestions, null, 2));
    console.log('📊 Questions count:', rawQuestions?.length || 0);

    if (!rawQuestions || rawQuestions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not extract questions from PDF' },
        { status: 400 }
      );
    }

    // Convert Gemini format to frontend format
    const questions = rawQuestions.map((q, index) => {
      console.log(`🔄 Converting Question ${index + 1}:`, {
        fullQuestion: q,
        type: q.type,
        correctIndex: q.correctIndex,
        correctIndexes: q.correctIndexes,
        hasCorrectIndex: q.hasOwnProperty('correctIndex'),
        hasCorrectIndexes: q.hasOwnProperty('correctIndexes')
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
        originalCorrectIndex: q.correctIndex,
        originalCorrectIndexes: q.correctIndexes
      };

      console.log(`✅ Converted Question ${index + 1}:`, {
        question: converted.question?.substring(0, 50) + '...',
        correctAnswer: converted.correctAnswer,
        correctAnswerType: typeof converted.correctAnswer,
        type: converted.type
      });

      return converted;
    });

    console.log('🎯 Final converted questions:', questions.map((q, i) => ({
      index: i + 1,
      correctAnswer: q.correctAnswer,
      type: q.type
    })));

    return NextResponse.json({
      success: true,
      data: {
        title,
        description,
        questions,
        originalFileName: pdfFile.name,
        fileSize: pdfFile.size
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