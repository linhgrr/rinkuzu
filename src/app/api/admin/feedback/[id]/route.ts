import { withCommunicationRead } from '@/lib/api/communication-read';
import { getFeedback } from '@/lib/communication/feedback';

export const GET = withCommunicationRead('admin-feedback-detail', getFeedback);
