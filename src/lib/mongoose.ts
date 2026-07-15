import 'server-only';
import mongoose from 'mongoose';

import { env } from './env';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// In production / hot-reload dev, cache the mongoose connection on the
// global object so HMR doesn't open a fresh connection on every request.
declare global {
  var __rinkuzuMongoose: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.__rinkuzuMongoose ?? { conn: null, promise: null };
globalThis.__rinkuzuMongoose = cached;

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(env.MONGODB_URI, {
      autoCreate: false,
      autoIndex: false,
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
