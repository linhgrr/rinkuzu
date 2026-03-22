import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { QuizAskAiRequest } from '@/lib/quiz/ask-ai';
import {
  generateQuizAskAiResponse,
  streamQuizAskAiResponse,
  validateQuizAskAiInput,
} from '@/lib/quiz/ask-ai-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await request.json() as QuizAskAiRequest;

    if (!payload.question || !Array.isArray(payload.options)) {
      return NextResponse.json(
        { success: false, error: 'Question and options are required' },
        { status: 400 }
      );
    }

    if (payload.userQuestion) {
      const validation = validateQuizAskAiInput(payload.userQuestion);

      if (!validation.isValid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        );
      }
    }

    console.log('🤖 Ask AI request:', {
      user: session.user.email,
      question: `${payload.question.substring(0, 100)}...`,
      userQuestion: payload.userQuestion || 'General explanation',
      optionsCount: payload.options.length,
      chatHistoryLength: payload.chatHistory?.length || 0,
      stream: payload.stream === true,
    });

    if (payload.stream) {
      const upstream = await streamQuizAskAiResponse(payload);

      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const data = await generateQuizAskAiResponse(payload);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Ask AI error:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get AI explanation' },
      { status: 500 }
    );
  }
}
