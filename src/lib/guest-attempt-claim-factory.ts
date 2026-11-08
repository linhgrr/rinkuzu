import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { GuestAttemptClaimService } from '@/services/quiz/GuestAttemptClaimService';

let service: GuestAttemptClaimService | undefined;

export function getGuestAttemptClaimService(): GuestAttemptClaimService {
  service ??= new GuestAttemptClaimService(new QuizAttemptProgressRepository());
  return service;
}
