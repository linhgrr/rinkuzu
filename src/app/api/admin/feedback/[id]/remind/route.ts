import { remindFeedbackSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { remindFeedback } from '@/lib/communication/feedback';

export const POST = withCommunicationMutation(
  remindFeedbackSchema,
  'admin-feedback-remind',
  (id, body, actor) => remindFeedback(id, actor, body),
);
