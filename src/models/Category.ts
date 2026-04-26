import mongoose from 'mongoose';

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 80
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  color: {
    type: String,
    default: '#009d8c', // Default blue color
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
  if (this.isModified('name')) {
    this.slug = toSlug(this.name);
  }

  if (!this.slug && this.name) {
    this.slug = toSlug(this.name);
  }

  this.updatedAt = new Date();
  next();
});

// Index for efficient searching
CategorySchema.index({ name: 'text', description: 'text' });
CategorySchema.index({ isActive: 1, name: 1 });
CategorySchema.index({ slug: 1, isActive: 1 });

export default mongoose.models.Category || mongoose.model('Category', CategorySchema);