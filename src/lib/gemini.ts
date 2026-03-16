// src/lib/gemini.ts
import { createLangChainModel, HumanMessage, getKeysCount } from './langchain';

export async function buildChunkLevelPrompt(
  userPrompt: string,
  chunkCount: number
): Promise<string> {
  // If no user prompt or only 1 chunk, return original prompt
  if (!userPrompt || chunkCount <= 1) return userPrompt || '';

  const model = createLangChainModel({ temperature: 0 });

  const systemMessage = new HumanMessage({
    content: `You are an AI assistant helping to format instructions for a document chunking system.
The user wants to extract questions from a PDF, but the PDF is split into ${chunkCount} parts.
Their original instruction was: "${userPrompt}"

Rewrite their instruction so that it makes sense when applied to just ONE INDIVIDUAL CHUNK out of ${chunkCount} parts.
Ensure the logic still holds (e.g. if they ask for exactly 20 questions total, change it to ask for roughly ${Math.ceil(20 / chunkCount)} questions per part).
- Keep it concise.
- If the userPrompt already references per-chunk/each part, keep it unchanged.
- If the userPrompt does not specify a total count, return it unchanged.

Return ONLY the rewritten prompt text, no extra formatting or explanation.`
  });

  try {
    const response = await model.invoke([systemMessage]);
    return String(response.content).trim();
  } catch (error) {
    console.error('Error rewriting prompt for chunks, falling back to original:', error);
    return userPrompt;
  }
}

export async function generateQuizTitle(content: string): Promise<string> {
  if (!content || content.trim().length === 0) return 'Untitled Quiz';

  const model = createLangChainModel({ temperature: 0.7 });

  const prompt = `Based on the following content, generate a short, catchy, and relevant title for a quiz.
The title should be max 6 words.
Return ONLY the title, without quotes or extra text.

Content:
${content.substring(0, 1500)}...`; // Use first 1500 chars

  try {
    const response = await model.invoke([new HumanMessage(prompt)]);
    let title = String(response.content).trim();
    // Clean up quotes if model added them
    title = title.replace(/^["']|["']$/g, '');
    return title;
  } catch (error) {
    console.error('Failed to generate quiz title:', error);
    return 'Generated Quiz';
  }
}
