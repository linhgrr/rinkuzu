import { LearningProgressRepository } from '@/repositories/LearningProgressRepository';
import { LearningProgressService } from '@/services/learning/LearningProgressService';

let learningProgressService: LearningProgressService | undefined;

export function getLearningProgressService(): LearningProgressService {
  learningProgressService ??= new LearningProgressService(new LearningProgressRepository());
  return learningProgressService;
}
