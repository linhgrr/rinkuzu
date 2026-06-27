import mongoose, { Document, Schema, Types } from 'mongoose';

interface IFolderQuizDocument extends Document {
  owner: Types.ObjectId;
  quiz: Types.ObjectId;
  folder: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FolderQuizSchema = new Schema<IFolderQuizDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    folder: { type: Schema.Types.ObjectId, ref: 'Folder', required: true },
  },
  { timestamps: true },
);

FolderQuizSchema.index({ owner: 1, quiz: 1 }, { unique: true });
FolderQuizSchema.index({ owner: 1, folder: 1 });

export default mongoose.models['FolderQuiz'] ||
  mongoose.model<IFolderQuizDocument>('FolderQuiz', FolderQuizSchema);
