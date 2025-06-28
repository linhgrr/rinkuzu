import { IQuizService, CreateQuizRequest, QuizListOptions } from '@/interfaces/services/IQuizService'
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository'
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository'
import { IUserRepository } from '@/interfaces/repositories/IUserRepository'
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository'
import { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository'
import { IReportRepository } from '@/interfaces/repositories/IReportRepository'
import { generateSlug } from '@/lib/utils'
import { IQuiz } from '@/interfaces/repositories/IQuizRepository'
import SubscriptionService from '@/services/subscription/SubscriptionService'

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class QuizService implements IQuizService {
  constructor(
    private quizRepository: IQuizRepository,
    private categoryRepository: ICategoryRepository,
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository,
    private discussionRepository: IDiscussionRepository,
    private reportRepository: IReportRepository
  ) {}

  async getQuizzes(options: QuizListOptions): Promise<{
    quizzes: IQuiz[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const { status, search, category, page = 1, limit = 10, userRole, userId } = options

    let filter: any = {}

    // Role-based filtering
    if (userRole === 'admin') {
      // Admin can see all quizzes, optionally filtered by status
      if (status) filter.status = status
    } else {
      // For regular users
      if (status === 'published') {
        // Check if user has premium subscription for private quizzes
        let isPremium = false
        if (userId) {
          const subscriptionService = new SubscriptionService()
          isPremium = await subscriptionService.isUserPremium(userId)
        }

        if (isPremium) {
          // Premium users can see all published quizzes (including private)
          filter.status = 'published'
        } else {
          // Non-premium users can only see published non-private quizzes + their own
          filter = {
            status: 'published',
            $or: [
              { isPrivate: false },
              { author: userId }
            ]
          }
        }
      } else if (status === 'pending' || status === 'rejected') {
        // Only their own pending/rejected quizzes
        filter = { author: userId, status }
      } else {
        // Default: check premium status for private quizzes
        let isPremium = false
        if (userId) {
          const subscriptionService = new SubscriptionService()
          isPremium = await subscriptionService.isUserPremium(userId)
        }

        if (isPremium) {
          // Premium users can see all published quizzes + their own
          filter = {
            $or: [
              { status: 'published' },
              { author: userId }
            ]
          }
        } else {
          // Non-premium users can only see published non-private quizzes + their own
          filter = {
            $or: [
              { status: 'published', isPrivate: false },
              { author: userId }
            ]
          }
        }
      }
    }

    // Add category filter
    if (category && category.trim()) {
      filter.category = category.trim()
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i')
      filter.$and = filter.$and || []
      filter.$and.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex }
        ]
      })
    }

    return await this.quizRepository.findAll(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: ['author', 'category']
    })
  }

  async createQuiz(userId: string, quizData: CreateQuizRequest): Promise<IQuiz> {
    const { title, description, category, questions, isPrivate } = quizData

    if (!title || !category || !questions || !Array.isArray(questions) || questions.length === 0) {
      throw new Error('Title, category, and questions are required')
    }

    // Validate category exists and is active
    const categoryDoc = await this.categoryRepository.findById(category)
    if (!categoryDoc || !categoryDoc.isActive) {
      throw new Error('Invalid or inactive category selected')
    }

    // Validate questions format
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]

      if (!question.question || typeof question.question !== 'string') {
        throw new Error(`Question ${i + 1}: Missing or invalid question text`)
      }

      if (!question.options || !Array.isArray(question.options)) {
        throw new Error(`Question ${i + 1}: Missing or invalid options array`)
      }

      if (question.options.length < 2) {
        throw new Error(`Question ${i + 1}: Need at least 2 options`)
      }

      // Check each option is a string
      for (let j = 0; j < question.options.length; j++) {
        if (typeof question.options[j] !== 'string') {
          throw new Error(`Question ${i + 1}, Option ${j + 1}: Must be a string`)
        }
      }

      // Validate question type and answers
      const questionType = question.type || 'single'
      if (!['single', 'multiple'].includes(questionType)) {
        throw new Error(`Question ${i + 1}: Type must be 'single' or 'multiple'`)
      }

      if (questionType === 'single') {
        if (typeof question.correctIndex !== 'number' || 
            question.correctIndex < 0 || 
            question.correctIndex >= question.options.length) {
          throw new Error(`Question ${i + 1}: Invalid correct answer index`)
        }
      } else {
        if (!Array.isArray(question.correctIndexes) || question.correctIndexes.length === 0) {
          throw new Error(`Question ${i + 1}: Multiple choice questions need at least one correct answer`)
        }
        
        for (const idx of question.correctIndexes) {
          if (typeof idx !== 'number' || idx < 0 || idx >= question.options.length) {
            throw new Error(`Question ${i + 1}: Invalid correct answer index`)
          }
        }
      }
    }

    // Generate unique slug
    const baseSlug = generateSlug(title)
    let slug = baseSlug
    let counter = 1
    
    while (await this.quizRepository.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    const quiz = await this.quizRepository.create({
      title,
      description,
      slug,
      author: userId,
      category,
      questions,
      status: 'pending',
      isPrivate: !!isPrivate
    })

    return quiz
  }

  async getQuizById(id: string, userEmail?: string, userRole?: string, userId?: string): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.findById(id);
      
      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404
        };
      }

      // Check permissions for private quizzes
      if (quiz.isPrivate) {
        if (!userEmail) {
          return {
            success: false,
            error: 'Authentication required to access private quiz',
            statusCode: 401
          };
        }

        // Admin can access all private quizzes
        if (userRole === 'admin') {
          return { success: true, data: quiz };
        }

        // Author can access their own private quizzes
        if (quiz.author.toString() === userId) {
          return { success: true, data: quiz };
        }

        // Check if user has premium subscription
        if (userId) {
          const subscriptionService = new SubscriptionService();
          const isPremium = await subscriptionService.isUserPremium(userId);

          if (!isPremium) {
            return {
              success: false,
              error: 'Premium subscription required to access private quizzes',
              statusCode: 403
            };
          }
        } else {
          return {
            success: false,
            error: 'Premium subscription required to access private quizzes',
            statusCode: 403
          };
        }
      }

      return { success: true, data: quiz };
    } catch (error) {
      console.error('Error in getQuizById:', error);
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500
      };
    }
  }

  async getQuizBySlug(slug: string): Promise<IQuiz | null> {
    return await this.quizRepository.findBySlug(slug);
  }

  async getQuizForPlay(slug: string, userRole?: string, userId?: string): Promise<any> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);
      
    if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404
        };
      }

      if (quiz.status !== 'published') {
        return {
          success: false,
          error: 'Quiz is not available',
          statusCode: 404
        };
    }

      // Check permissions for private quizzes
    if (quiz.isPrivate) {
      if (!userId) {
          return {
            success: false,
            error: 'Authentication required to access private quiz',
            statusCode: 401
          };
      }

        // Admin can access all private quizzes
        if (userRole === 'admin') {
          return { success: true, data: quiz };
        }

        // Author can access their own private quizzes
        if (quiz.author.toString() === userId) {
          return { success: true, data: quiz };
        }

        // Check if user has premium subscription
        const subscriptionService = new SubscriptionService();
        const isPremium = await subscriptionService.isUserPremium(userId);

        if (!isPremium) {
          return {
            success: false,
            error: 'Premium subscription required to access private quizzes',
            statusCode: 403
          };
      }
    }

    // Return quiz without correct answers for playing
      const quizForPlay = {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      author: quiz.author,
      slug: quiz.slug,
        category: quiz.category,
        status: quiz.status,
        isPrivate: quiz.isPrivate,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
      questions: quiz.questions.map((q: any) => ({
        question: q.question,
        options: q.options,
        type: q.type,
          questionImage: q.questionImage,
          optionImages: q.optionImages
        }))
      };

      return { success: true, data: quizForPlay };
    } catch (error) {
      console.error('Error in getQuizForPlay:', error);
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500
      };
    }
  }

  async updateQuiz(id: string, quizData: any, userEmail: string, userRole?: string): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.findById(id);
      
      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404
        };
      }

      // Check permissions
      const isAdmin = userRole === 'admin';
      const isAuthor = (quiz.author as any)?._id 
        ? (quiz.author as any)._id.toString() === userEmail
        : quiz.author === userEmail;

      if (!isAdmin && !isAuthor) {
        return {
          success: false,
          error: 'Access denied',
          statusCode: 403
        };
      }

      const updatedQuiz = await this.quizRepository.update(id, quizData);
      
      return {
        success: true,
        data: updatedQuiz
      };
    } catch (error) {
      console.error('Update quiz error:', error);
      return {
        success: false,
        error: 'Failed to update quiz',
        statusCode: 500
      };
    }
  }

  async deleteQuiz(id: string, userEmail: string, userRole?: string): Promise<ServiceResult<boolean>> {
    try {
      const quiz = await this.quizRepository.findById(id);
      
      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404
        };
      }

      // Check permissions
      const isAdmin = userRole === 'admin';
      const isAuthor = (quiz.author as any)?._id 
        ? (quiz.author as any)._id.toString() === userEmail
        : quiz.author === userEmail;

      if (!isAdmin && !isAuthor) {
        return {
          success: false,
          error: 'Access denied',
          statusCode: 403
        };
      }

      const result = await this.quizRepository.delete(id);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Delete quiz error:', error);
      return {
        success: false,
        error: 'Failed to delete quiz',
        statusCode: 500
      };
    }
  }

  async approveQuiz(id: string): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.updateStatus(id, 'published');
      
      return {
        success: true,
        data: quiz
      };
    } catch (error) {
      console.error('Approve quiz error:', error);
      return {
        success: false,
        error: 'Failed to approve quiz',
        statusCode: 500
      };
    }
  }

  async rejectQuiz(id: string, reason?: string): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.updateStatus(id, 'rejected', reason);
      
      return {
        success: true,
        data: quiz
      };
    } catch (error) {
      console.error('Reject quiz error:', error);
      return {
        success: false,
        error: 'Failed to reject quiz',
        statusCode: 500
      };
    }
  }

  async previewFromPdf(title: string, description: string, pdfFiles: File[]): Promise<ServiceResult<any>> {
    try {
      // This would typically process PDF files and extract questions
      // For now, return a mock preview
      return {
        success: true,
        data: {
          title,
          description,
          questions: []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to preview from PDF',
        statusCode: 500
      };
    }
  }

  async reportQuiz(slug: string, content: string, reporterEmail: string, reporterName: string): Promise<ServiceResult<string>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);
      
      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404
        }
      }

      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: 'Report content is required',
          statusCode: 400
        };
      }

      const report = await this.reportRepository.create({
        quiz: quiz._id.toString(),
        reporter: reporterEmail,
        reason: content.trim(),
        description: reporterName,
        status: 'pending'
      });

      if (!report || !report._id) {
        return {
          success: false,
          error: 'Report not created',
          statusCode: 500
        }
      }

      return {
        success: true,
        data: report._id.toString()
      };
    } catch (error) {
      console.error('Report quiz error:', error);
      return {
        success: false,
        error: 'Failed to report quiz',
        statusCode: 500
      };
    }
  }

  async submitQuizAttempt(
    slug: string, 
    answers: any[], 
    session: any, 
    userEmail?: string
  ): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.findBySlugAndStatus(slug, 'published')
      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found or not published',
          statusCode: 404
        }
      }

      // Get or create user
      let userId: string
      if (session?.user?.email) {
        // Logged in user
        const user = await this.userRepository.findByEmail(session.user.email)
        if (!user) {
          return {
            success: false,
            error: 'User not found',
            statusCode: 404
          }
        }
        userId = user._id.toString()
      } else if (userEmail) {
        // Non-logged in user with email - use email as identifier
        userId = userEmail
      } else {
        return {
          success: false,
          error: 'User identification required',
          statusCode: 400
        }
      }

      // Validate answers format
      if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
        return {
          success: false,
          error: 'Invalid answers format',
          statusCode: 400
        }
      }

      // Format answers according to validation rules
      const formattedAnswers = answers.map((answer, index) => {
        const question = quiz.questions[index]
        
        if (question.type === 'single') {
          // Single choice: -1 for unanswered, >= 0 for answered
          return answer === -1 ? -1 : (typeof answer === 'number' && answer >= 0 ? answer : -1)
        } else if (question.type === 'multiple') {
          // Multiple choice: empty array for unanswered, array of >= 0 for answered
          if (!Array.isArray(answer) || answer.length === 0) {
            return []
          }
          return answer.filter(a => typeof a === 'number' && a >= 0)
        }
        return answer
      })

      // Calculate score
      let correctAnswers = 0
      const totalQuestions = quiz.questions.length

      for (let i = 0; i < totalQuestions; i++) {
        const question = quiz.questions[i]
        const userAnswer = formattedAnswers[i]

        if (question.type === 'single') {
          if (userAnswer === question.correctIndex) {
            correctAnswers++
          }
        } else if (question.type === 'multiple') {
          const userAnswers = Array.isArray(userAnswer) ? userAnswer.sort() : []
          const correctAnswers_q = Array.isArray(question.correctIndexes) ? question.correctIndexes.sort() : []
          
          if (JSON.stringify(userAnswers) === JSON.stringify(correctAnswers_q)) {
            correctAnswers++
          }
        }
      }

      const score = Math.round((correctAnswers / totalQuestions) * 100)

      // Save attempt
      const attempt = await this.attemptRepository.create({
        user: userId,
        quiz: quiz._id,
        answers: formattedAnswers,
        score,
        totalQuestions,
        takenAt: new Date()
      })

      return {
        success: true,
        data: { 
          score, 
          correctAnswers, 
          totalQuestions, 
          attemptId: attempt._id 
        }
      }
    } catch (error: any) {
      console.error('Submit quiz attempt error:', error)
      return {
        success: false,
        error: 'Failed to submit quiz attempt',
        statusCode: 500
      }
    }
  }

  async getQuizDiscussions(slug: string): Promise<ServiceResult<any[]>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);
      
      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404
        };
      }

      const existingDiscussions = await this.discussionRepository.findByQuiz(quiz._id.toString());
      
      // Create discussions for all questions if they don't exist
      const allDiscussions = [];
      for (let i = 0; i < quiz.questions.length; i++) {
        const existingDiscussion = existingDiscussions.find(d => d.questionIndex === i);
        
        if (existingDiscussion) {
          allDiscussions.push(existingDiscussion);
        } else {
          // Create empty discussion for this question
          const newDiscussion = await this.discussionRepository.create({
            quiz: quiz._id.toString(),
            user: quiz.author,
            questionIndex: i,
            content: `Discussion for question ${i + 1}`,
            comments: []
          });
          allDiscussions.push(newDiscussion);
        }
      }

      return {
        success: true,
        data: allDiscussions
      };
    } catch (error) {
      console.error('Get quiz discussions error:', error);
      return {
        success: false,
        error: 'Failed to fetch discussions',
        statusCode: 500
      };
    }
  }

  async addDiscussionComment(
    slug: string, 
    questionIndex: number, 
    content: string, 
    userEmail: string
  ): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);
      
      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404
        };
      }

      if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
        return {
          success: false,
          error: 'Invalid question index',
          statusCode: 400
        };
      }

      const user = await this.userRepository.findByEmail(userEmail);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404
        };
      }

      // Find or create discussion for this question
      let discussions = await this.discussionRepository.findByQuiz(quiz._id.toString());
      let existingDiscussion = discussions.find(d => d.questionIndex === questionIndex);

      if (!existingDiscussion) {
        // Create new discussion for this question
        existingDiscussion = await this.discussionRepository.create({
          quiz: quiz._id.toString(),
          user: quiz.author,
          questionIndex,
          content: `Discussion for question ${questionIndex + 1}`,
          comments: []
        });
      }

      if (!existingDiscussion || !existingDiscussion._id) {
        return {
          success: false,
          error: 'Failed to create or find discussion',
          statusCode: 500
        };
      }

      // Add comment to existing discussion
      const commentData = {
        author: user._id,
        authorEmail: user.email,
        content,
        isEdited: false,
        createdAt: new Date()
      };
      
      const updatedDiscussion = await this.discussionRepository.update(
        existingDiscussion._id.toString(),
        {
          comments: [...(existingDiscussion.comments || []), commentData]
        }
      );
      
      return {
        success: true,
        data: updatedDiscussion
      };
    } catch (error) {
      console.error('Add discussion comment error:', error);
      return {
        success: false,
        error: 'Failed to add comment',
        statusCode: 500
      };
    }
  }

  async getQuizFlashcards(slug: string, session?: any): Promise<any> {
    const quiz = await this.quizRepository.findBySlugAndStatus(slug, 'published')
    if (!quiz) {
      throw new Error('Quiz not found or not published')
    }

    // Check if quiz is private and user has access
    if (quiz.isPrivate && session?.user) {
      const isAdmin = (session.user as any).role === 'admin';
      const isAuthor = (quiz.author as any)?._id 
        ? (quiz.author as any)._id.toString() === (session.user as any).id
        : quiz.author === (session.user as any).id;

      if (!isAdmin && !isAuthor) {
        // Check if user has premium subscription
        const subscriptionService = new SubscriptionService();
        const isPremium = await subscriptionService.isUserPremium((session.user as any).id);

        if (!isPremium) {
          throw new Error('Premium subscription required to access private quizzes');
        }
      }
    }

    const flashcards = quiz.questions.map((q: any, index: number) => ({
      id: index,
      question: q.question,
      answer: q.type === 'single' 
        ? q.options[q.correctIndex]
        : q.correctIndexes.map((idx: number) => q.options[idx]).join(', '),
      type: q.type,
      questionImage: q.questionImage || null,
      optionImages: q.optionImages || []
    }))

    return {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      slug: quiz.slug,
      flashcards
    }
  }

  async getQuizForFlashcards(slug: string, session: any): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);
      
      if (!quiz || quiz.status !== 'published') {
        return {
          success: false,
          error: 'Quiz not found or not published',
          statusCode: 404
        };
      }

      // Check if quiz is private and user has access
      if (quiz.isPrivate) {
        if (!session?.user) {
          return {
            success: false,
            error: 'Access denied. This quiz is private.',
            statusCode: 403
          };
        }

        const isAdmin = (session.user as any).role === 'admin';
        const isAuthor = (quiz.author as any)?._id 
          ? (quiz.author as any)._id.toString() === (session.user as any).id
          : quiz.author === (session.user as any).id;

        if (!isAdmin && !isAuthor) {
          // Check if user has premium subscription
          const subscriptionService = new SubscriptionService();
          const isPremium = await subscriptionService.isUserPremium((session.user as any).id);

          if (!isPremium) {
            return {
              success: false,
              error: 'Premium subscription required to access private quizzes',
              statusCode: 403
            };
          }
        }
      }

      // Return quiz with correct answers for flashcards
      const flashcardQuiz = {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        author: quiz.author,
        slug: quiz.slug,
        questions: quiz.questions.map((q: any) => ({
          question: q.question,
          options: q.options,
          type: q.type,
          correctIndex: q.correctIndex,
          correctIndexes: q.correctIndexes,
        })),
        createdAt: quiz.createdAt,
      };

      return {
        success: true,
        data: flashcardQuiz
      };
    } catch (error) {
      console.error('Get quiz for flashcards error:', error);
      return {
        success: false,
        error: 'Failed to get quiz for flashcards',
        statusCode: 500
      };
    }
  }
} 