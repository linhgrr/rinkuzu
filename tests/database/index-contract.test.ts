import { describe, expect, it } from 'vitest';

import { INDEX_CONTRACT } from '../../scripts/database/index-contract.mjs';
import {
  canonicalizeIndexOptions,
  canonicalizeKey,
  stableStringify,
  validateIndexContract,
} from '../../scripts/database/index-planner.mjs';
import Attempt from '@/models/Attempt';
import AuditLog from '@/models/AuditLog';
import Bookmark from '@/models/Bookmark';
import Discussion from '@/models/Discussion';
import Folder from '@/models/Folder';
import FolderQuiz from '@/models/FolderQuiz';
import QuestionProgress from '@/models/QuestionProgress';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import Report from '@/models/Report';
import Subscription from '@/models/Subscription';
import User from '@/models/User';
import UserProgress from '@/models/UserProgress';

const MODELS = {
  attempts: Attempt,
  auditlogs: AuditLog,
  bookmarks: Bookmark,
  discussions: Discussion,
  folders: Folder,
  folderquizzes: FolderQuiz,
  questionprogresses: QuestionProgress,
  quizzes: Quiz,
  quizprogresses: QuizProgress,
  reports: Report,
  subscriptions: Subscription,
  users: User,
  userprogresses: UserProgress,
};

describe('database index contract registry', () => {
  it('is internally valid', () => {
    expect(validateIndexContract(INDEX_CONTRACT)).toEqual([]);
  });

  it('matches every Mongoose schema index in both directions', () => {
    for (const [collection, model] of Object.entries(MODELS)) {
      const schemaIndexes = model.schema
        .indexes()
        .map(([key, options]) => signature(key, options))
        .sort();
      const registryIndexes = INDEX_CONTRACT.filter(
        (entry) =>
          entry.collection === collection &&
          ['required_active', 'candidate_active', 'emergency'].includes(entry.lifecycle),
      )
        .map((entry) => signature(entry.key, entry.options))
        .sort();

      expect(registryIndexes, `${collection} registry must exactly mirror its schema`).toEqual(
        schemaIndexes,
      );
    }
  });

  it('keeps every legacy removal in hide-before-drop lifecycle', () => {
    const deprecated = INDEX_CONTRACT.filter((entry) => entry.lifecycle === 'deprecated_hidden');

    expect(deprecated).toHaveLength(12);
    expect(deprecated.every((entry) => !('hiddenSince' in entry))).toBe(true);
    expect(deprecated.every((entry) => !('dropAfter' in entry))).toBe(true);
    expect(deprecated).toContainEqual(
      expect.objectContaining({
        id: 'quizzes.legacy-text-search',
        key: { _fts: 'text', _ftsx: 1 },
      }),
    );
  });
});

function signature(key: Record<string, unknown>, options: Record<string, unknown> = {}) {
  return stableStringify({
    key: canonicalizeKey(key),
    options: { ...canonicalizeIndexOptions(options), hidden: false },
  });
}
