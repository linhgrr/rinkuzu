import { QuizService } from '@/services/quiz/QuizService';
import { UserService } from '@/services/user/UserService';
import { BookmarkService } from '@/services/bookmark/BookmarkService';
import { CategoryService } from '@/services/category/CategoryService';
import { AdminService } from '@/services/admin/AdminService';

import { QuizRepository } from '@/repositories/QuizRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { CategoryRepository } from '@/repositories/CategoryRepository';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { DiscussionRepository } from '@/repositories/DiscussionRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { BookmarkRepository } from '@/repositories/BookmarkRepository';

import { createSubscriptionService } from '@/lib/subscription-factory';
import type { SubscriptionService } from '@/services/subscription/SubscriptionService';

interface Repositories {
  quiz: QuizRepository;
  user: UserRepository;
  category: CategoryRepository;
  attempt: AttemptRepository;
  discussion: DiscussionRepository;
  report: ReportRepository;
  bookmark: BookmarkRepository;
}

interface Services {
  quiz?: QuizService;
  user?: UserService;
  bookmark?: BookmarkService;
  category?: CategoryService;
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
      category: new CategoryRepository(),
      attempt: new AttemptRepository(),
      discussion: new DiscussionRepository(),
      report: new ReportRepository(),
      bookmark: new BookmarkRepository(),
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
        this.repositories.category,
        this.repositories.user,
        this.repositories.attempt,
        this.repositories.discussion,
        this.repositories.report,
      );
    }
    return this.services.quiz;
  }

  getUserService(): UserService {
    if (!this.services.user) {
      this.services.user = new UserService(this.repositories.user, this.repositories.attempt);
    }
    return this.services.user;
  }

  getBookmarkService(): BookmarkService {
    if (!this.services.bookmark) {
      this.services.bookmark = new BookmarkService(this.repositories.bookmark);
    }
    return this.services.bookmark;
  }

  getCategoryService(): CategoryService {
    if (!this.services.category) {
      this.services.category = new CategoryService(
        this.repositories.category,
        this.repositories.quiz,
      );
    }
    return this.services.category;
  }

  getAdminService(): AdminService {
    if (!this.services.admin) {
      this.services.admin = new AdminService(
        this.repositories.category,
        this.repositories.user,
        this.repositories.report,
        this.repositories.quiz,
        this.repositories.attempt,
      );
    }
    return this.services.admin;
  }

  // Direct repository access when needed
  getUserRepository(): UserRepository {
    return this.repositories.user;
  }

  getCategoryRepository(): CategoryRepository {
    return this.repositories.category;
  }

  getAttemptRepository(): AttemptRepository {
    return this.repositories.attempt;
  }

  getReportRepository(): ReportRepository {
    return this.repositories.report;
  }

  /**
   * @deprecated Import `createSubscriptionService` from `@/lib/subscription-factory` directly.
   * Kept for backward-compat; resolves to the standalone factory.
   */
  static createSubscriptionService(): SubscriptionService {
    return createSubscriptionService();
  }
}

export const serviceFactory = ServiceFactory.getInstance();
