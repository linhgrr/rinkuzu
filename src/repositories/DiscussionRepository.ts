import connectDB from '@/lib/mongoose';
import Discussion from '@/models/Discussion';
import { BaseRepository } from '@/repositories/base';
import {
  IDiscussion,
  IDiscussionRepository,
} from '@/interfaces/repositories/IDiscussionRepository';

export class DiscussionRepository
  extends BaseRepository<IDiscussion>
  implements IDiscussionRepository
{
  constructor() {
    super(Discussion);
  }

  override async findById(id: string): Promise<IDiscussion | null> {
    await connectDB();
    return (await Discussion.findById(id)
      .populate('comments.author', 'email name displayName avatar')
      .lean()) as unknown as IDiscussion | null;
  }

  async findByQuiz(quizId: string): Promise<IDiscussion[]> {
    await connectDB();
    return (await Discussion.find({ quiz: quizId })
      .populate('comments.author', 'email name displayName avatar')
      .sort({ questionIndex: 1, createdAt: 1 })
      .lean()) as unknown as IDiscussion[];
  }

  override async create(discussionData: Partial<IDiscussion>): Promise<IDiscussion> {
    await connectDB();
    const discussion = new Discussion(discussionData);
    const saved = await discussion.save();
    return (await Discussion.findById(saved._id)
      .populate('comments.author', 'email name displayName avatar')
      .lean()) as unknown as IDiscussion;
  }

  override async update(
    id: string,
    discussionData: Partial<IDiscussion>,
  ): Promise<IDiscussion | null> {
    await connectDB();
    return (await Discussion.findByIdAndUpdate(id, discussionData, { new: true })
      .populate('comments.author', 'email name displayName avatar')
      .lean()) as unknown as IDiscussion | null;
  }
}
