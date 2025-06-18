import { GoogleGenerativeAI } from '@google/generative-ai';

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

export async function extractQuestionsFromPdf(buffer: Buffer | string): Promise<any[]> {
  const maxRetries = Math.min(keys.length, 3);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const apiKey = getNextKey();
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `
You are given educational content that may include questions, explanations, and references to images or diagrams.

Your task is to extract or generate quiz questions (both single-choice and multiple-choice) from this content.

Important Instructions:

1. **DO NOT OMIT ANY TEXT.** Even if the text refers to or is adjacent to an image (e.g., "In the diagram above", "Refer to the image", etc.), you must extract the full surrounding question text exactly as it appears.
2. **IGNORE IMAGES ENTIRELY.** Do not describe, summarize, or attempt to interpret any image content. Only process the visible text — even if it partially depends on an image.
3. **PRESERVE ALL CONTEXTUAL TEXT.** If a question is written around or near an image, still extract the full question text as-is. Do not skip it.
4. **NEVER DROP OR SKIP ANY QUESTION just because it involves an image.** Your job is to preserve every meaningful question or prompt in textual form.
5. Do not fabricate or modify content. Extract exact original wording where possible.
6. Reconstruct questions from visible text if they are implied or structured around diagrams or image references.
7. Return ONLY a JSON array in the following format:

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
- Use "type": "single" for one correct answer, with "correctIndex" (0–3)
- Use "type": "multiple" for multiple correct answers, with "correctIndexes" (array of indexes 0–3)
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
      
      // Validate the questions format
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions format');
      }
      
      // No image processing needed - users will add images manually
      const processedQuestions = questions;
      
      // Validate each question with detailed logging
      for (let i = 0; i < processedQuestions.length; i++) {
        const q = processedQuestions[i];
        
        console.log(`🔍 Gemini validating Question ${i + 1}:`, {
          hasQuestion: !!q.question,
          hasOptions: !!q.options,
          optionsLength: q.options?.length,
          type: q.type,
          correctIndex: q.correctIndex,
          correctIndexes: q.correctIndexes,

        });

        if (!q.question || !Array.isArray(q.options) || 
            q.options.length < 2 || !q.type ||
            !['single', 'multiple'].includes(q.type)) {
          console.error(`❌ Gemini Question ${i + 1}: Invalid basic format`);
          throw new Error(`Invalid question format at position ${i + 1}`);
        }
        
        if (q.type === 'single') {
          if (typeof q.correctIndex !== 'number' ||
              q.correctIndex < 0 || q.correctIndex >= q.options.length) {
            console.error(`❌ Gemini Question ${i + 1}: Invalid correctIndex ${q.correctIndex} for ${q.options.length} options`);
            throw new Error(`Invalid single choice question at position ${i + 1}: correctIndex must be 0-${q.options.length - 1}`);
          }
        } else if (q.type === 'multiple') {
          if (!Array.isArray(q.correctIndexes) || q.correctIndexes.length === 0 ||
              q.correctIndexes.some((idx: number) => typeof idx !== 'number' || idx < 0 || idx >= q.options.length)) {
            console.error(`❌ Gemini Question ${i + 1}: Invalid correctIndexes`, q.correctIndexes);
            throw new Error(`Invalid multiple choice question at position ${i + 1}: correctIndexes must be valid array`);
          }
        }

        console.log(`✅ Gemini Question ${i + 1}: Valid`);
      }
      
      console.log('✅ All Gemini questions validated successfully');
      
      return processedQuestions;
      
    } catch (error: any) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to extract questions after ${maxRetries} attempts: ${error.message}`);
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