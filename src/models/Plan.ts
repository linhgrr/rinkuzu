import mongoose, { Schema, Document } from 'mongoose'

export interface IPlan extends Document {
  _id: string
  name: string
  price: number
  duration: string
  features: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
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

PlanSchema.virtual('id').get(function (this: any) {
  return this._id
})

const Plan = mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema)

export default Plan 