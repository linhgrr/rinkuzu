import { quizSlugRouteParamsSchema } from '@/dtos/quiz';
import { readAndValidateRouteParams, type RouteParams } from '@/lib/api/request';
import { apiErr } from '@/lib/api/response';

type QuizSlugRouteParamsResult =
  | { success: true; slug: string }
  | { success: false; response: Response };

export function parseQuizSlugRouteParams(params: RouteParams): QuizSlugRouteParamsResult {
  const parsed = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
  if (parsed.success) return { success: true, slug: parsed.data.slug };

  return {
    success: false,
    response: apiErr('validation_error', parsed.error, 400, {
      fields: parsed.fields,
    }),
  };
}
