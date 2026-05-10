import connectDB from '@/lib/mongoose';
import mongoose from 'mongoose';

export class BaseRepository<T> {
  constructor(protected model: mongoose.Model<any>) {}

  async findById(id: string): Promise<T | null> {
    await connectDB();
    return (await this.model.findById(id).lean()) as T | null;
  }

  async create(data: Partial<T>): Promise<T> {
    await connectDB();
    const doc: any = new this.model(data);
    await doc.save();
    return doc.toObject() as T;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    await connectDB();
    return (await this.model.findByIdAndUpdate(id, data, { new: true }).lean()) as T | null;
  }

  async delete(id: string): Promise<boolean> {
    await connectDB();
    const result = await this.model.findByIdAndDelete(id);
    return !!result;
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    await connectDB();
    return await this.model.countDocuments(filter || {});
  }
}
