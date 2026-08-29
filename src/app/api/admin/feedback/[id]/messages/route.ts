import { createFeedbackMessageSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { addFeedbackMessage } from '@/lib/communication/feedback';

export const POST = withCommunicationMutation(
  createFeedbackMessageSchema,
  'admin-feedback-message',
  (id, body, actor) => addFeedbackMessage(id, actor, body),
);
