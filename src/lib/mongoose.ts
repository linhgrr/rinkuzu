import mongoose from 'mongoose';

const MONGO_URL = process.env.MONGO_URL;
const BUILD_PHASE = 'phase-production-build';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// In production, use a global variable to avoid multiple connections
let cached: MongooseCache = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB(): Promise<typeof mongoose> {
  if (!MONGO_URL) {
    if (process.env.NEXT_PHASE === BUILD_PHASE) {
      return mongoose;
    }
    throw new Error('Please add your MONGO_URL to .env.local');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGO_URL, opts);
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
