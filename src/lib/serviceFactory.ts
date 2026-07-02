import { QuizService } from '@/services/quiz/QuizService';
import { UserService } from '@/services/user/UserService';
import { BookmarkService } from '@/services/bookmark/BookmarkService';
import { AdminService } from '@/services/admin/AdminService';

import { QuizRepository } from '@/repositories/QuizRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { DiscussionRepository } from '@/repositories/DiscussionRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { BookmarkRepository } from '@/repositories/BookmarkRepository';
import { QuizProgressRepository } from '@/repositories/QuizProgressRepository';
import { FolderRepository } from '@/repositories/FolderRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';

interface Repositories {
  quiz: QuizRepository;
  user: UserRepository;
  attempt: AttemptRepository;
  discussion: DiscussionRepository;
  report: ReportRepository;
  bookmark: BookmarkRepository;
  quizProgress: QuizProgressRepository;
  folder: FolderRepository;
  quizAttemptProgress: QuizAttemptProgressRepository;
}

interface Services {
  quiz?: QuizService;
  user?: UserService;
  bookmark?: BookmarkService;
  admin?: AdminService;
}

export class ServiceFactory {
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
      bookmark: new BookmarkRepository(),
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
        this.repositories.attempt,
        this.repositories.discussion,
        this.repositories.report,
        this.repositories.quizProgress,
        this.repositories.folder,
        this.repositories.quizAttemptProgress,
      );
    }
    return this.services.quiz;
  }

  getUserService(): UserService {
    if (!this.services.user) {
      this.services.user = new UserService(
        this.repositories.user,
        this.repositories.attempt,
        this.repositories.quiz,
      );
    }
    return this.services.user;
  }

  getBookmarkService(): BookmarkService {
    if (!this.services.bookmark) {
      this.services.bookmark = new BookmarkService(this.repositories.bookmark);
    }
    return this.services.bookmark;
  }

  getAdminService(): AdminService {
    if (!this.services.admin) {
      this.services.admin = new AdminService(
        this.repositories.user,
        this.repositories.report,
        this.repositories.quiz,
        this.repositories.attempt,
      );
    }
    return this.services.admin;
  }
}

export const serviceFactory = ServiceFactory.getInstance();
