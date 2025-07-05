import mongoose, { Schema, Document } from 'mongoose'
import { SubscriptionDurationType, DurationUtils } from '@/types/subscription'

export interface IPlan extends Document {
  _id: string
  name: string
  price: number
  duration: string // ISO 8601 format (P1M, P3M, P1Y, PT0S)
  features: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // Virtual fields
  readonly durationInfo: {
    iso8601: string
    displayName: string
    months?: number
  }
  readonly isLifetime: boolean
}

const PlanSchema = new Schema<IPlan>({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  duration: {
    type: String,
    required: true,
    validate: {
      validator: function(value: string) {
        // Allow legacy formats during migration
        try {
          if (DurationUtils.isValidISO8601Duration(value)) {
            return true
          }
          // Check if it's a legacy format that can be converted
          DurationUtils.fromLegacyDuration(value)
          return true
        } catch {
          return false
        }
      },
      message: 'Invalid duration format. Use ISO 8601 format (P1M, P3M, P1Y) or legacy format for migration.'
    }
  },
  features: {
    type: [String],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true
})

// Virtual for duration info
PlanSchema.virtual('durationInfo').get(function (this: IPlan) {
  try {
    // If already ISO 8601, use directly
    if (DurationUtils.isValidISO8601Duration(this.duration)) {
      return DurationUtils.getDurationInfo(this.duration)
    }
    
    // Convert legacy format
    const iso8601 = DurationUtils.fromLegacyDuration(this.duration)
    return DurationUtils.getDurationInfo(iso8601)
  } catch {
    return {
      iso8601: this.duration,
      displayName: this.duration,
      months: undefined
    }
  }
})

// Virtual for checking if lifetime
PlanSchema.virtual('isLifetime').get(function (this: IPlan) {
  const info = this.durationInfo
  return info.months === undefined
})

// Pre-save middleware to migrate legacy durations
PlanSchema.pre('save', function(this: IPlan) {
  if (!DurationUtils.isValidISO8601Duration(this.duration)) {
    try {
      this.duration = DurationUtils.fromLegacyDuration(this.duration)
    } catch (error) {
      console.warn(`Could not migrate duration '${this.duration}' for plan ${this.name}:`, error)
    }
  }
})

PlanSchema.virtual('id').get(function (this: any) {
  return this._id
})

// Ensure virtuals are included in JSON
PlanSchema.set('toJSON', { virtuals: true })
PlanSchema.set('toObject', { virtuals: true })

const Plan = mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema)

export default Plan 