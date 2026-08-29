import { completeFeedbackSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { completeFeedback } from '@/lib/communication/feedback';

export const POST = withCommunicationMutation(
  completeFeedbackSchema,
  'admin-feedback-complete',
  (id, body, actor) => completeFeedback(id, actor, body.revision),
);
