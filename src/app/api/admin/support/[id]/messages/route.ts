import { createSupportMessageSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { addSupportMessage } from '@/lib/communication/support';

export const POST = withCommunicationMutation(
  createSupportMessageSchema,
  'admin-support-message',
  (id, body, { id: userId, email }) => addSupportMessage(id, userId, email, body, true),
);
