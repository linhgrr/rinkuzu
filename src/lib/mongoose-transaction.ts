import 'server-only';

import mongoose from 'mongoose';
import type { ClientSession, mongo } from 'mongoose';

import connectDB from '@/lib/mongoose';

export type TransactionWork<T> = (session: ClientSession) => Promise<T>;

/**
 * Runs `work` inside one Mongo transaction and closes the session afterwards.
 *
 * This existed already, as runBillingTransaction in the billing repositories,
 * with nothing about billing in its body. The name is what confined it: about
 * twenty other call sites write the same four steps by hand -- connect, start a
 * session, run the transaction, end the session in a finally -- because a
 * helper filed under billing is not one anybody else goes looking for. This is
 * the idiom for new transactional code.
 *
 * Those twenty are not migrated. Every one of them was checked and every one
 * already ends its session in a finally, so the helper would buy uniformity
 * rather than close a hole, and it would buy it with twenty rewrites through
 * billing and entitlement paths. Two of them should stay hand-rolled whatever
 * happens to the rest: src/lib/llm/rate-limit.ts takes its session from the raw
 * driver client rather than from mongoose, and UserRepository wraps
 * startSession in its own catch so it can tell "the cluster would not give me a
 * session" apart from "the transaction failed" -- a distinction this helper
 * hides by design.
 *
 * Return the callback's value; never write to a variable declared outside it.
 * withTransaction retries on a transient error, and an outer variable keeps
 * whatever the losing attempt put there.
 */
export async function runInTransaction<T>(
  work: TransactionWork<T>,
  options?: mongo.TransactionOptions,
): Promise<T> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(work, options);
  } finally {
    await session.endSession();
  }
}
