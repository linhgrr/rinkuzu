import 'server-only';

import type { IGuestDraftClaimService } from '@/interfaces/services/IGuestDraftClaimService';
import { getGuestAttemptClaimService } from '@/lib/guest-attempt-claim-factory';
import { getGuestDraftRefresher } from '@/lib/guest-draft-factory';
import { createGuestDraftEvents } from '@/lib/guest-draft/events';
import { getQuizService } from '@/lib/quiz-factory';
import { GuestDraftAttemptRepository } from '@/repositories/GuestDraftAttemptRepository';
import { GuestQuizDraftRepository } from '@/repositories/GuestQuizDraftRepository';
import { GuestDraftClaimService } from '@/services/quiz/GuestDraftClaimService';

let service: IGuestDraftClaimService | undefined;

export function getGuestDraftClaimService(): IGuestDraftClaimService {
  service ??= new GuestDraftClaimService(
    new GuestQuizDraftRepository(),
    new GuestDraftAttemptRepository(),
    getQuizService(),
    getGuestAttemptClaimService(),
    createGuestDraftEvents(),
    getGuestDraftRefresher(),
  );
  return service;
}
