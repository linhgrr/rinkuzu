import { QuizService } from '@/services/quiz/QuizService';

import { QuizRepository } from '@/repositories/QuizRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { DiscussionRepository } from '@/repositories/DiscussionRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { QuizProgressRepository } from '@/repositories/QuizProgressRepository';
import { FolderRepository } from '@/repositories/FolderRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';

interface Repositories {
  quiz: QuizRepository;
  user: UserRepository;
  discussion: DiscussionRepository;
  report: ReportRepository;
  quizProgress: QuizProgressRepository;
  folder: FolderRepository;
  quizAttemptProgress: QuizAttemptProgressRepository;
}

interface Services {
  quiz?: QuizService;
}

class ServiceFactory {
  private static instance: ServiceFactory;
  private repositories: Repositories;
  private services: Services = {};

  private constructor() {
    this.repositories = {
      quiz: new QuizRepository(),
      user: new UserRepository(),
      discussion: new DiscussionRepository(),
      report: new ReportRepository(),
      quizProgress: new QuizProgressRepository(),
      folder: new FolderRepository(),
      quizAttemptProgress: new QuizAttemptProgressRepository(),
    };
  }

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  getQuizService(): QuizService {
    if (!this.services.quiz) {
      this.services.quiz = new QuizService(
        this.repositories.quiz,
        this.repositories.user,
        this.repositories.discussion,
        this.repositories.report,
        this.repositories.quizProgress,
        this.repositories.quizAttemptProgress,
        this.repositories.folder,
      );
    }
    return this.services.quiz;
  }
}

export const serviceFactory = ServiceFactory.getInstance();
