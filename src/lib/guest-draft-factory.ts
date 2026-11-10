import 'server-only';

import type { IGuestDraftAttemptService } from '@/interfaces/services/IGuestDraftAttemptService';
import type { IGuestDraftService } from '@/interfaces/services/IGuestDraftService';
import { createGuestDraftEvents } from '@/lib/guest-draft/events';
import { createGuestDraftLimiter } from '@/lib/guest-draft/limits';
import { createGuestDraftUpstream } from '@/lib/guest-draft/upstream';
import { GuestQuizDraftRepository } from '@/repositories/GuestQuizDraftRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { GuestDraftAttemptService } from '@/services/quiz/GuestDraftAttemptService';
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

let attemptService: IGuestDraftAttemptService | undefined;

export function getGuestDraftAttemptService(): IGuestDraftAttemptService {
  attemptService ??= new GuestDraftAttemptService(
    new GuestQuizDraftRepository(),
    new QuizAttemptProgressRepository(),
  );
  return attemptService;
}
