import { QuizService } from '@/services/quiz/QuizService';
import { AdminService } from '@/services/admin/AdminService';

import { QuizRepository } from '@/repositories/QuizRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { DiscussionRepository } from '@/repositories/DiscussionRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { QuizProgressRepository } from '@/repositories/QuizProgressRepository';
import { FolderRepository } from '@/repositories/FolderRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';

interface Repositories {
  quiz: QuizRepository;
  user: UserRepository;
  attempt: AttemptRepository;
  discussion: DiscussionRepository;
  report: ReportRepository;
  quizProgress: QuizProgressRepository;
  folder: FolderRepository;
  quizAttemptProgress: QuizAttemptProgressRepository;
  adminStats: AdminStatsRepository;
}

interface Services {
  quiz?: QuizService;
  admin?: AdminService;
}

class ServiceFactory {
  private static instance: ServiceFactory;
  private repositories: Repositories;
  private services: Services = {};

  private constructor() {
    this.repositories = {
      quiz: new QuizRepository(),
      user: new UserRepository(),
      attempt: new AttemptRepository(),
      discussion: new DiscussionRepository(),
      report: new ReportRepository(),
      quizProgress: new QuizProgressRepository(),
      folder: new FolderRepository(),
      quizAttemptProgress: new QuizAttemptProgressRepository(),
      adminStats: new AdminStatsRepository(),
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

  getAdminService(): AdminService {
    if (!this.services.admin) {
      this.services.admin = new AdminService(
        this.repositories.user,
        this.repositories.report,
        this.repositories.quiz,
        this.repositories.attempt,
        this.repositories.adminStats,
      );
    }
    return this.services.admin;
  }
}

export const serviceFactory = ServiceFactory.getInstance();
