import mongoose, { Schema, type Types } from 'mongoose';

/**
 * A public quiz's place in a topic hub (RIN-1248). The unique `quizId` index
 * keeps a quiz in at most one topic; `order` is its 1-based place in the hub.
 */
interface QuizTopicAssignmentDocument {
  quizId: Types.ObjectId;
  topicId: Types.ObjectId;
  order: number;
  assignedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const QuizTopicAssignmentSchema = new Schema<QuizTopicAssignmentDocument>(
  {
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'QuizTopic', required: true },
    order: { type: Number, required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

QuizTopicAssignmentSchema.index({ quizId: 1 }, { unique: true });
QuizTopicAssignmentSchema.index({ topicId: 1, order: 1, createdAt: -1 });

const QuizTopicAssignment =
  (mongoose.models['QuizTopicAssignment'] as
    | mongoose.Model<QuizTopicAssignmentDocument>
    | undefined) ??
  mongoose.model<QuizTopicAssignmentDocument>('QuizTopicAssignment', QuizTopicAssignmentSchema);

export default QuizTopicAssignment;
