import mongoose from 'mongoose';

export interface IReport {
  _id?: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  reporterEmail: string;
  reporterName: string;
  content: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  adminNotes?: string;
}

const reportSchema = new mongoose.Schema<IReport>({
  quizId: {
    type: String,
    required: true
  },
  quizTitle: {
    type: String,
    required: true
  },
  quizSlug: {
    type: String,
    required: true
  },
  reporterEmail: {
    type: String,
    required: true
  },
  reporterName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: String
  },
  adminNotes: {
    type: String,
    maxlength: 1000
  }
});

// Index for efficient queries
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ quizId: 1 });

const Report = mongoose.models.Report || mongoose.model<IReport>('Report', reportSchema);

export default Report; 