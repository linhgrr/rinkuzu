import { buildAdaptiveServiceHeaders, resolveAdaptiveApiUrl } from '@/lib/adaptive-learning/config';
import { fetchApiSuccess } from '@/lib/api/client';

type ExtractQuizResult = {
  questions: any[];
};

type ExtractQuizFromS3KeyParams = {
  s3Key: string;
  userId: string;
  userPrompt?: string;
  timeoutMs?: number;
};

type ExtractApiResponse = {
  questions?: any[];
  s3_key?: string;
};

/**
 * Calls the Python quiz extraction endpoint for a PDF already stored on S3.
 */
export async function extractQuizFromS3Key(
  params: ExtractQuizFromS3KeyParams,
): Promise<ExtractQuizResult> {
  const { s3Key, userId, userPrompt, timeoutMs = 280000 } = params;

  const formDataPayload = new FormData();
  formDataPayload.append('s3_key', s3Key);

  if (userPrompt?.trim()) {
    formDataPayload.append('user_prompt', userPrompt.trim());
  }

  const apiUrl = resolveAdaptiveApiUrl();

  const result = await fetchApiSuccess<ExtractApiResponse>(`${apiUrl}/api/quiz/extract`, {
    method: 'POST',
    body: formDataPayload,
    headers: buildAdaptiveServiceHeaders(userId),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!Array.isArray(result.data?.questions)) {
    throw new Error('Failed to extract questions from Python API');
  }

  return {
    questions: result.data.questions,
  };
}
