import connectDB from '@/lib/mongoose';
import type { FilterQuery, Model, UpdateQuery } from 'mongoose';

/**
 * Generic base repository over a Mongoose `Model`.
 *
 * - `TDoc` is the persisted document interface (the same shape passed to
 *   `Schema<TDoc>` / `model<TDoc>` — does NOT need to extend `Document`).
 * - `TLean` is the lean / plain-object shape returned to callers — defaults to TDoc.
 *
 * Subclasses pass the strongly-typed `Model` and may override methods with
 * sharper return types when populating/projecting.
 */
export class BaseRepository<TDoc, TLean = TDoc> {
  constructor(protected model: Model<TDoc>) {}

  async findById(id: string): Promise<TLean | null> {
    await connectDB();
    return (await this.model.findById(id).lean<TLean>()) ?? null;
  }

  async create(data: Partial<TDoc>): Promise<TLean> {
    await connectDB();
    const doc = new this.model(data);
    await doc.save();
    return doc.toObject() as unknown as TLean;
  }

  async update(id: string, data: UpdateQuery<TDoc>): Promise<TLean | null> {
    await connectDB();
    return (await this.model.findByIdAndUpdate(id, data, { new: true }).lean<TLean>()) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    await connectDB();
    const result = await this.model.findByIdAndDelete(id);
    return !!result;
  }

  async count(filter?: FilterQuery<TDoc>): Promise<number> {
    await connectDB();
    return await this.model.countDocuments(filter ?? {});
  }
}
