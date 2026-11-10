import 'server-only';

import type { IGuestDraftService } from '@/interfaces/services/IGuestDraftService';
import { createGuestDraftEvents } from '@/lib/guest-draft/events';
import { createGuestDraftLimiter } from '@/lib/guest-draft/limits';
import { createGuestDraftUpstream } from '@/lib/guest-draft/upstream';
import { GuestQuizDraftRepository } from '@/repositories/GuestQuizDraftRepository';
import { GuestDraftService } from '@/services/quiz/GuestDraftService';

let service: IGuestDraftService | undefined;

export function getGuestDraftService(): IGuestDraftService {
  service ??= new GuestDraftService(
    new GuestQuizDraftRepository(),
    createGuestDraftLimiter(),
    createGuestDraftUpstream(),
    createGuestDraftEvents(),
  );
  return service;
}
