import connectDB from '@/lib/mongoose'
import Discussion from '@/models/Discussion'
import { IDiscussion, IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository'

export class DiscussionRepository implements IDiscussionRepository {
  async findById(id: string): Promise<IDiscussion | null> {
    await connectDB()
    return await Discussion.findById(id)
      .populate('comments.author', 'email')
      .lean() as unknown as IDiscussion | null
  }

  async findByQuiz(quizId: string): Promise<IDiscussion[]> {
    await connectDB()
    return await Discussion.find({ quiz: quizId })
      .populate('comments.author', 'email')
      .sort({ questionIndex: 1, createdAt: 1 })
      .lean() as unknown as IDiscussion[]
  }

  async create(discussionData: Partial<IDiscussion>): Promise<IDiscussion> {
    await connectDB()
    const discussion = new Discussion(discussionData)
    const saved = await discussion.save()
    return await Discussion.findById(saved._id)
      .populate('comments.author', 'email')
      .lean() as unknown as IDiscussion
  }

  async update(id: string, discussionData: Partial<IDiscussion>): Promise<IDiscussion | null> {
    await connectDB()
    return await Discussion.findByIdAndUpdate(id, discussionData, { new: true })
      .populate('comments.author', 'email')
      .lean() as unknown as IDiscussion | null
  }

  async delete(id: string): Promise<boolean> {
    await connectDB()
    const result = await Discussion.findByIdAndDelete(id)
    return !!result
  }

  async count(filter: any = {}): Promise<number> {
    await connectDB()
    return await Discussion.countDocuments(filter)
  }
}