import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  color: {
    type: String,
    default: '#3B82F6', // Default blue color
    match: /^#[0-9A-F]{6}$/i // Hex color validation
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
CategorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient searching
CategorySchema.index({ name: 'text', description: 'text' });
CategorySchema.index({ isActive: 1, name: 1 });

export default mongoose.models.Category || mongoose.model('Category', CategorySchema); 