import { buildAdaptiveServiceHeaders, resolveAdaptiveApiUrl } from '@/lib/adaptive-learning/config';

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
  success: boolean;
  data?: {
    questions?: any[];
    s3_key?: string;
  };
  error?: string;
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

  const response = await fetch(`${apiUrl}/api/quiz/extract`, {
    method: 'POST',
    body: formDataPayload,
    headers: buildAdaptiveServiceHeaders(userId),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const result = (await response.json()) as ExtractApiResponse;
  if (!result.success || !Array.isArray(result.data?.questions)) {
    throw new Error(result.error || 'Failed to extract questions from Python API');
  }

  return {
    questions: result.data.questions,
  };
}
