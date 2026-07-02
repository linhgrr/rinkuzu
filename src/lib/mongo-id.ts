import mongoose, { Types } from 'mongoose';

export function isValidMongoObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

export function toMongoObjectIdOrString(value: string): Types.ObjectId | string {
  return isValidMongoObjectId(value) ? new mongoose.Types.ObjectId(value) : value;
}

export function serializeId(value: unknown, fieldName: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    const id = value.toString();
    if (id && id !== '[object Object]') {
      return id;
    }
  }

  throw new TypeError(`${fieldName} is required`);
}
