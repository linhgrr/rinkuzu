import { QuizService } from '@/services/quiz/QuizService'
import { UserService } from '@/services/user/UserService'
import { AuthService } from '@/services/auth/AuthService'
import { BookmarkService } from '@/services/bookmark/BookmarkService'
import { CategoryService } from '@/services/category/CategoryService'
import { AdminService } from '@/services/admin/AdminService'

import { QuizRepository } from '@/repositories/QuizRepository'
import { UserRepository } from '@/repositories/UserRepository'
import { CategoryRepository } from '@/repositories/CategoryRepository'
import { AttemptRepository } from '@/repositories/AttemptRepository'
import { DiscussionRepository } from '@/repositories/DiscussionRepository'
import { ReportRepository } from '@/repositories/ReportRepository'
import { BookmarkRepository } from '@/repositories/BookmarkRepository'

class ServiceFactory {
  private static instance: ServiceFactory
  private repositories: {
    quiz: QuizRepository
    user: UserRepository
    category: CategoryRepository
    attempt: AttemptRepository
    discussion: DiscussionRepository
    report: ReportRepository
    bookmark: BookmarkRepository
  }
  private services: {
    quiz?: QuizService
    user?: UserService
    auth?: AuthService
    bookmark?: BookmarkService
    category?: CategoryService
    admin?: AdminService
  } = {}

  private constructor() {
    // Initialize repositories
    this.repositories = {
      quiz: new QuizRepository(),
      user: new UserRepository(),
      category: new CategoryRepository(),
      attempt: new AttemptRepository(),
      discussion: new DiscussionRepository(),
      report: new ReportRepository(),
      bookmark: new BookmarkRepository()
    }
  }

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory()
    }
    return ServiceFactory.instance
  }

  getQuizService(): QuizService {
    if (!this.services.quiz) {
      this.services.quiz = new QuizService(
        this.repositories.quiz,
        this.repositories.category,
        this.repositories.user,
        this.repositories.attempt,
        this.repositories.discussion,
        this.repositories.report
      )
    }
    return this.services.quiz
  }

  getUserService(): UserService {
    if (!this.services.user) {
      this.services.user = new UserService(
        this.repositories.user,
        this.repositories.attempt
      )
    }
    return this.services.user
  }

  getAuthService(): AuthService {
    if (!this.services.auth) {
      this.services.auth = new AuthService(this.repositories.user)
    }
    return this.services.auth
  }

  getBookmarkService(): BookmarkService {
    if (!this.services.bookmark) {
      this.services.bookmark = new BookmarkService(this.repositories.bookmark)
    }
    return this.services.bookmark
  }

  getCategoryService(): CategoryService {
    if (!this.services.category) {
      this.services.category = new CategoryService(
        this.repositories.category,
        this.repositories.quiz
      )
    }
    return this.services.category
  }

  getAdminService(): AdminService {
    if (!this.services.admin) {
      this.services.admin = new AdminService(
        this.repositories.category,
        this.repositories.user,
        this.repositories.report,
        this.repositories.quiz,
        this.repositories.attempt
      )
    }
    return this.services.admin
  }

  // Direct repository access when needed
  getUserRepository(): UserRepository {
    return this.repositories.user
  }

  getCategoryRepository(): CategoryRepository {
    return this.repositories.category
  }

  getAttemptRepository(): AttemptRepository {
    return this.repositories.attempt
  }

  getReportRepository(): ReportRepository {
    return this.repositories.report
  }
}

export const serviceFactory = ServiceFactory.getInstance() 