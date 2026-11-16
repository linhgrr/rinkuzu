import { createImageQuizDraftFieldsSchema } from '@/dtos/quiz-draft';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { quizDraftJobLinkFromEnvelope } from '@/lib/quiz/draft-usage';
import { countImageRejection, readImageUploadForm } from '@/lib/quiz/image-source-request';

export const dynamic = 'force-dynamic';
/** The API runs OCR on every page before it answers (RIN-1782). */
export const maxDuration = 60;
const IMAGE_DRAFT_TIMEOUT_MS = 50_000;

/**
 * Signed-in quiz draft from 1-5 photos (RIN-1792). The photos are checked here before the
 * API is called, then metered like a PDF draft: one `quiz_extract` unit linked to the
 * draft so a failed extraction refunds it. Unlike the PDF route, any non-2xx from the API
 * (422 `too_little_text`, 400, 503) refunds the unit: nothing was extracted. The photos
 * are forwarded only and never logged or stored.
 */
export const POST = withAuth(async (request, { userId, session }) => {
  const upload = await readImageUploadForm(request, 'create_photo');
  if (!upload.ok) return upload.response;

  const fields = createImageQuizDraftFieldsSchema.safeParse({
    title: upload.form.get('title'),
    description: upload.form.get('description') ?? undefined,
    category_id: upload.form.get('category_id') ?? undefined,
    prompt: upload.form.get('prompt') ?? undefined,
    submit_to_premium: upload.form.get('submit_to_premium') ?? undefined,
  });
  if (!fields.success) return apiErr('validation_error', 'Invalid photo draft request', 400);

  const body = new FormData();
  const { submit_to_premium: submitToPremium, ...rest } = fields.data;
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === 'string') body.append(key, value);
  }
  if (submitToPremium !== undefined) body.append('submit_to_premium', String(submitToPremium));
  upload.images.forEach((image, index) => body.append('images', image, `page-${index + 1}.jpg`));

  const response = await proxyAdaptiveRequest(
    request,
    '/quiz/drafts/image',
    { userId, userRole: session.user.role },
    {
      method: 'POST',
      body,
      // No content type: fetch sets the multipart boundary itself.
      contentType: null,
      timeoutMs: IMAGE_DRAFT_TIMEOUT_MS,
      llmAction: 'quiz_extract',
      llmJobLink: quizDraftJobLinkFromEnvelope,
      refundOnClientError: true,
    },
  );
  if (response.status === 422) {
    const bytes = upload.images.reduce((sum, image) => sum + image.size, 0);
    const code = await response
      .clone()
      .json()
      .then((payload: { error?: { code?: unknown } }) => payload.error?.code)
      .catch(() => null);
    if (code === 'too_little_text')
      await countImageRejection('create_photo', 'too_little_text', bytes);
  }
  return response;
});
