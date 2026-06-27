import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFolderDocument extends Document {
  name: string;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolderDocument>(
  {
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
      maxlength: [100, 'Folder name cannot exceed 100 characters'],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Folder owner is required'],
    },
  },
  { timestamps: true },
);

FolderSchema.index({ owner: 1, name: 1 }, { unique: true });

export default mongoose.models['Folder'] || mongoose.model<IFolderDocument>('Folder', FolderSchema);
