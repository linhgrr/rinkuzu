export interface IDiscussion {
  _id?: string
  quiz: string
  user: string
  questionIndex: number
  content: string
  createdAt?: Date
  updatedAt?: Date
}

export interface IDiscussionRepository {
  findById(id: string): Promise<IDiscussion | null>
  
  findByQuiz(quizId: string): Promise<IDiscussion[]>
  
  create(discussionData: Partial<IDiscussion>): Promise<IDiscussion>
  
  update(id: string, discussionData: Partial<IDiscussion>): Promise<IDiscussion | null>
  
  delete(id: string): Promise<boolean>
  
  count(filter?: any): Promise<number>
} 