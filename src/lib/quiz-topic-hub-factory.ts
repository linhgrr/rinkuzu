import { QuizRepository } from '@/repositories/QuizRepository';
import { QuizTopicHubRepository } from '@/repositories/QuizTopicHubRepository';
import { QuizTopicHubService } from '@/services/quiz/QuizTopicHubService';

let quizTopicHubService: QuizTopicHubService | undefined;

/** Topic hub read service, for the hub pages and the sitemap (RIN-1249). */
export function getQuizTopicHubService(): QuizTopicHubService {
  quizTopicHubService ??= new QuizTopicHubService({
    hubRepository: new QuizTopicHubRepository(),
    ownerRepository: new QuizRepository(),
  });
  return quizTopicHubService;
}
