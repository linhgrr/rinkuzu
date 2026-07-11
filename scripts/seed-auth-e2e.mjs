import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

if (!uri || !email || !password) {
  throw new Error('MONGODB_URI, E2E_USER_EMAIL and E2E_USER_PASSWORD are required');
}

const databaseName = decodeURIComponent(new URL(uri).pathname.slice(1));
if (!/(^|[-_])(test|ci)($|[-_])/i.test(databaseName)) {
  throw new Error(
    `Refusing to seed non-test database: ${databaseName || '(missing database name)'}`,
  );
}

await mongoose.connect(uri);
try {
  const now = new Date();
  await mongoose.connection.collection('users').updateOne(
    { email: email.trim().toLowerCase() },
    {
      $set: {
        emailVerified: now,
        failedLoginAttempts: 0,
        failedLoginWindowStart: null,
        lockedUntil: null,
      },
      $setOnInsert: {
        email: email.trim().toLowerCase(),
        password: await bcrypt.hash(password, 12),
        displayName: 'Auth E2E User',
        role: 'user',
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
} finally {
  await mongoose.disconnect();
}
