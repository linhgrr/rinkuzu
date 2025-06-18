import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authOptions } from '@/lib/auth';

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

// POST /api/quiz/ask-ai - Get AI explanation for a quiz question
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { question, options, userQuestion, questionImage, optionImages } = await request.json();

    if (!question || !options || !Array.isArray(options)) {
      return NextResponse.json(
        { success: false, error: 'Question and options are required' },
        { status: 400 }
      );
    }

    console.log('🤖 Ask AI request:', {
      user: session.user?.email,
      question: question.substring(0, 100) + '...',
      userQuestion: userQuestion || 'General explanation',
      optionsCount: options.length
    });

    const maxRetries = Math.min(keys.length, 3);
    
    const fetchImageBase64 = async (url: string): Promise<string | null> => {
      try {
        const res = await fetch(url);
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.toString('base64');
      } catch {
        return null;
      }
    };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const apiKey = getNextKey();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const prompt = `
You are an AI tutor helping students understand quiz questions. Please provide a helpful, educational explanation.

QUIZ QUESTION:
"${question}"

OPTIONS:
${options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n')}

${userQuestion ? `STUDENT'S SPECIFIC QUESTION: "${userQuestion}"` : ''}

Please provide:
1. A clear explanation of what the question is asking
2. Key concepts or knowledge needed to answer this question
3. How to approach thinking about this type of question
4. ${userQuestion ? 'A specific answer to the student\'s question' : 'General tips for understanding similar questions'}

IMPORTANT: 
- Answer in the same language as the question
- Focus on helping the student understand the concepts
- Be educational and encouraging
- Use simple, clear language
- Provide learning guidance, not just the answer

Response should be helpful for learning, not cheating.
        `;

        const parts: any[] = [{ text: prompt }];

        if (questionImage) {
          const b64 = await fetchImageBase64(questionImage);
          if (b64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
        }

        if (Array.isArray(optionImages)) {
          for (const img of optionImages) {
            if (!img) continue;
            const b64 = await fetchImageBase64(img);
            if (b64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
          }
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const explanation = response.text().trim();

        console.log('✅ AI explanation generated successfully');

        return NextResponse.json({
          success: true,
          data: {
            explanation,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error: any) {
        console.error(`Ask AI attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === maxRetries - 1) {
          throw new Error(`Failed to get AI explanation after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('All retry attempts failed');

  } catch (error: any) {
    console.error('Ask AI error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get AI explanation' },
      { status: 500 }
    );
  }
} 