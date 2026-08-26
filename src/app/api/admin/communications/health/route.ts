import { withAdmin } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
import { communicationHealth } from '@/lib/communication/service';

export const GET = withAdmin(async () => {
  try {
    return apiOk(await communicationHealth());
  } catch (error) {
    return communicationHttpError(error, 'communication-health');
  }
});
