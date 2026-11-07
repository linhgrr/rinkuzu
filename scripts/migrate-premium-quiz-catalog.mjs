import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import {
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const { loadEnvConfig } = nextEnv;
const MIGRATION_COMMENT = 'migrate-premium-quiz-catalog-v1';
const PREMIUM_ASSET_ROOT = 'premium/assets';
const PREMIUM_SOURCE_ROOT = 'uploads/premium_sources';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requiredStorageConfig(environment) {
  const keys = [
    'OBJECT_STORAGE_ENDPOINT_EXTERNAL',
    'OBJECT_STORAGE_REGION',
    'OBJECT_STORAGE_ACCESS_KEY',
    'OBJECT_STORAGE_SECRET_KEY',
    'OBJECT_STORAGE_BUCKET',
  ];
  for (const key of keys) {
    if (!environment[key]) throw new Error(`${key} is required for the Premium migration`);
  }
  return {
    endpoint: environment.OBJECT_STORAGE_ENDPOINT_EXTERNAL.replace(/\/+$/, ''),
    region: environment.OBJECT_STORAGE_REGION,
    accessKeyId: environment.OBJECT_STORAGE_ACCESS_KEY,
    secretAccessKey: environment.OBJECT_STORAGE_SECRET_KEY,
    bucket: environment.OBJECT_STORAGE_BUCKET,
    forcePathStyle: environment.OBJECT_STORAGE_ADDRESSING_STYLE === 'path',
    imageHost: imageCdnHost(environment),
  };
}

const DEFAULT_IMAGE_PUBLIC_BASE_URL = 'https://cdn.rinkuzu.app';

/**
 * Host of the public R2 image CDN (`IMAGE_PUBLIC_BASE_URL`, default cdn.rinkuzu.app).
 * @param {Record<string, string | undefined>} [environment]
 * @returns {string}
 */
export function imageCdnHost(environment = process.env) {
  return new URL(
    environment.IMAGE_PUBLIC_BASE_URL || DEFAULT_IMAGE_PUBLIC_BASE_URL,
  ).hostname.toLowerCase();
}

/**
 * Only https URLs on the image CDN may be fetch-copied into the private Premium namespace.
 * @param {string} sourceUrl
 * @param {string} imageHost
 * @returns {boolean}
 */
export function isCopyableImageUrl(sourceUrl, imageHost) {
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === imageHost;
}

function extractOwnedKey(sourceUrl, config) {
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }
  const endpoint = new URL(config.endpoint);
  const host = parsed.hostname.toLowerCase();
  const endpointHost = endpoint.hostname.toLowerCase();
  const pathPrefix = `/${config.bucket}/`;
  const pathStyle = host === endpointHost && parsed.pathname.startsWith(pathPrefix);
  const virtualStyle = host === `${config.bucket.toLowerCase()}.${endpointHost}`;
  if (!pathStyle && !virtualStyle) return null;
  const rawKey = pathStyle ? parsed.pathname.slice(pathPrefix.length) : parsed.pathname.slice(1);
  let key;
  try {
    key = rawKey
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    return null;
  }
  if (
    !key ||
    key.includes('\\') ||
    key.includes('\0') ||
    key.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }
  return key;
}

function imageExtension(contentType) {
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  if (contentType === 'image/gif') return '.gif';
  if (contentType === 'image/svg+xml') return '.svg';
  return '.jpg';
}

async function digestBody(body) {
  if (!body) return null;
  const hash = createHash('sha256');
  if (typeof body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of body) hash.update(chunk);
    return hash.digest('hex');
  }
  if (typeof body.transformToByteArray === 'function') {
    hash.update(await body.transformToByteArray());
    return hash.digest('hex');
  }
  return null;
}

export function createLegacyPremiumStorage(environment = process.env) {
  const config = requiredStorageConfig(environment);
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });
  return {
    async copyImage(sourceUrl, quizId) {
      if (sourceUrl.startsWith(`${PREMIUM_ASSET_ROOT}/`)) return sourceUrl;
      const ownedKey = extractOwnedKey(sourceUrl, config);
      if (ownedKey) {
        const destination = `${PREMIUM_ASSET_ROOT}/${quizId}/${sha256(ownedKey)}.jpg`;
        await client.send(
          new CopyObjectCommand({
            Bucket: config.bucket,
            Key: destination,
            CopySource: encodeURIComponent(`${config.bucket}/${ownedKey}`),
          }),
        );
        return destination;
      }
      if (!isCopyableImageUrl(sourceUrl, config.imageHost)) {
        throw new Error(`Unsupported legacy image host for quiz ${quizId}`);
      }
      const response = await fetch(new URL(sourceUrl), { redirect: 'error', cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not copy legacy image for quiz ${quizId}`);
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase();
      if (!contentType?.startsWith('image/')) throw new Error('Legacy asset is not an image');
      const body = new Uint8Array(await response.arrayBuffer());
      if (!body.byteLength || body.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(`Legacy image is empty or too large for quiz ${quizId}`);
      }
      const destination = `${PREMIUM_ASSET_ROOT}/${quizId}/${sha256(sourceUrl)}${imageExtension(contentType)}`;
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: destination,
          Body: body,
          ContentType: contentType,
          CacheControl: 'private, no-store, max-age=0',
        }),
      );
      return destination;
    },
    async copyPdf(sourceUrl, quizId) {
      const ownedKey = extractOwnedKey(sourceUrl, config);
      if (!ownedKey) return null;
      const response = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: ownedKey }),
      );
      const documentFingerprint = await digestBody(response.Body);
      if (!documentFingerprint) return null;
      const sourceObjectKey = `${PREMIUM_SOURCE_ROOT}/${quizId}/${documentFingerprint}.pdf`;
      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucket,
          Key: sourceObjectKey,
          CopySource: encodeURIComponent(`${config.bucket}/${ownedKey}`),
          ContentType: 'application/pdf',
          MetadataDirective: 'REPLACE',
          CacheControl: 'private, no-store, max-age=0',
        }),
      );
      return { documentFingerprint, sourceObjectKey };
    },
  };
}

export async function secureLegacyPremiumQuiz(quiz, storage) {
  const questions = await Promise.all(
    (quiz.questions ?? []).map(async (question) => ({
      ...question,
      ...(question.questionImage
        ? { questionImage: await storage.copyImage(question.questionImage, String(quiz._id)) }
        : {}),
      ...(question.optionImages
        ? {
            optionImages: await Promise.all(
              question.optionImages.map((image) =>
                image ? storage.copyImage(image, String(quiz._id)) : undefined,
              ),
            ),
          }
        : {}),
    })),
  );
  const securedQuiz = { ...quiz, questions };
  const publication = buildMigratedPremiumSnapshot(securedQuiz);
  const source = quiz.pdfUrl ? await storage.copyPdf(quiz.pdfUrl, String(quiz._id)) : null;
  return { ...publication, source };
}

function canonicalQuestion(question) {
  const answer =
    question.type === 'single'
      ? [question.correctIndex]
      : [...(question.correctIndexes ?? [])].sort((left, right) => left - right);
  return JSON.stringify({
    question: normalizeText(question.question),
    options: (question.options ?? []).map(normalizeText),
    type: question.type,
    answer,
  });
}

export function buildMigratedPremiumSnapshot(quiz) {
  const snapshot = {
    title: quiz.title,
    slug: quiz.slug,
    ...(quiz.description === undefined ? {} : { description: quiz.description }),
    questions: quiz.questions ?? [],
  };
  const questionHashes = snapshot.questions.map((question) => sha256(canonicalQuestion(question)));
  const snapshotHash = sha256(
    JSON.stringify({
      title: normalizeText(snapshot.title),
      description: normalizeText(snapshot.description),
      questions: snapshot.questions.map(canonicalQuestion),
    }),
  );
  return { snapshot, snapshotHash, questionHashes };
}

export async function migratePremiumQuizCatalog(
  db,
  { apply = false, storage = apply ? createLegacyPremiumStorage() : null } = {},
) {
  const quizzes = db.collection('quizzes');
  const submissions = db.collection('premiumquizsubmissions');
  const [publicQuizzes, privateQuizzes] = await Promise.all([
    quizzes.find({ isPrivate: false }, { projection: { _id: 1 } }).toArray(),
    quizzes
      .find(
        { isPrivate: true },
        {
          projection: {
            _id: 1,
            title: 1,
            slug: 1,
            description: 1,
            questions: 1,
            pdfUrl: 1,
            author: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .toArray(),
  ]);

  const existingSources = new Set(
    (
      await submissions
        .find(
          {
            sourceQuiz: { $in: privateQuizzes.map((quiz) => quiz._id) },
            status: 'approved',
            active: true,
          },
          { projection: { sourceQuiz: 1 } },
        )
        .toArray()
    ).map((submission) => String(submission.sourceQuiz)),
  );
  const publicationTargets = privateQuizzes.filter(
    (quiz) => !existingSources.has(String(quiz._id)),
  );
  const legacyImageCount = publicationTargets.reduce(
    (count, quiz) =>
      count +
      (quiz.questions ?? []).reduce(
        (questionCount, question) =>
          questionCount +
          (question.questionImage ? 1 : 0) +
          (question.optionImages ?? []).filter(Boolean).length,
        0,
      ),
    0,
  );
  const plan = {
    publicVisibilityUpdates: publicQuizzes.length,
    privateVisibilityUpdates: privateQuizzes.length,
    publicationsToCreate: publicationTargets.length,
    skippedExistingSubmissions: privateQuizzes.length - publicationTargets.length,
    legacyImagesToCopy: legacyImageCount,
    legacyPdfsToRetain: publicationTargets.filter((quiz) => quiz.pdfUrl).length,
  };
  if (!apply) return plan;
  if (!storage) throw new Error('Premium storage is required when applying the migration');

  // Publish immutable snapshots before removing the discriminator. If this
  // write fails, a retry can still rediscover every source from isPrivate.
  if (publicationTargets.length) {
    const securedTargets = await Promise.all(
      publicationTargets.map(async (quiz) => ({
        quiz,
        publication: await secureLegacyPremiumQuiz(quiz, storage),
      })),
    );
    await submissions.bulkWrite(
      securedTargets.map(({ quiz, publication }) => {
        const { snapshot, snapshotHash, questionHashes, source } = publication;
        const now = new Date();
        return {
          updateOne: {
            filter: { sourceQuiz: quiz._id, snapshotHash },
            update: {
              $setOnInsert: {
                sourceQuiz: quiz._id,
                author: quiz.author,
                version: 1,
                status: 'approved',
                sourceType: source ? 'pdf' : 'manual',
                rightsAttested: true,
                snapshot,
                snapshotHash,
                questionHashes,
                duplicateReport: {
                  exactDocumentRewarded: false,
                  exactQuiz: false,
                  sharedQuestionCount: 0,
                  highestSimilarity: 0,
                  matches: [],
                },
                reviewStatus: 'not_started',
                awardedCredits: 0,
                active: true,
                decidedAt: now,
                ...(source ?? {}),
                createdAt: quiz.createdAt ?? now,
                updatedAt: quiz.updatedAt ?? now,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false, comment: MIGRATION_COMMENT },
    );
  }

  if (publicQuizzes.length) {
    await quizzes.updateMany(
      { _id: { $in: publicQuizzes.map((quiz) => quiz._id) } },
      { $set: { visibility: 'public' }, $unset: { isPrivate: '' } },
      { comment: MIGRATION_COMMENT },
    );
  }
  if (privateQuizzes.length) {
    await quizzes.updateMany(
      { _id: { $in: privateQuizzes.map((quiz) => quiz._id) } },
      { $set: { visibility: 'personal' }, $unset: { isPrivate: '' } },
      { comment: MIGRATION_COMMENT },
    );
  }
  await submissions.updateMany(
    { sourceType: 'legacy' },
    { $set: { sourceType: 'manual' } },
    { comment: MIGRATION_COMMENT },
  );

  const indexes = await quizzes.listIndexes().toArray();
  for (const index of indexes) {
    if (index.name !== '_id_' && Object.hasOwn(index.key ?? {}, 'isPrivate')) {
      await quizzes.dropIndex(index.name, { comment: MIGRATION_COMMENT });
    }
  }
  return plan;
}

export async function verifyPremiumQuizCatalog(db) {
  const quizzes = db.collection('quizzes');
  const submissions = db.collection('premiumquizsubmissions');
  const [
    obsoletePrivacyFields,
    invalidVisibility,
    personalQuizIds,
    obsoleteSourceTypes,
    insecurePremiumAssets,
    invalidPremiumSourceKeys,
  ] = await Promise.all([
    quizzes.countDocuments({ isPrivate: { $exists: true } }),
    quizzes.countDocuments({ visibility: { $nin: ['public', 'personal'] } }),
    quizzes.find({ visibility: 'personal' }, { projection: { _id: 1 } }).toArray(),
    submissions.countDocuments({ sourceType: 'legacy' }),
    submissions.countDocuments({
      status: 'approved',
      active: true,
      'snapshot.questions': {
        $elemMatch: {
          $or: [
            { questionImage: { $exists: true, $not: /^premium\/assets\// } },
            {
              optionImages: {
                $elemMatch: { $type: 'string', $not: /^premium\/assets\// },
              },
            },
          ],
        },
      },
    }),
    submissions.countDocuments({
      sourceObjectKey: { $exists: true, $not: /^uploads\/premium_sources\// },
    }),
  ]);
  const activePersonalSources = new Set(
    (
      await submissions
        .find(
          {
            sourceQuiz: { $in: personalQuizIds.map((quiz) => quiz._id) },
            status: 'approved',
            active: true,
          },
          { projection: { sourceQuiz: 1 } },
        )
        .toArray()
    ).map((submission) => String(submission.sourceQuiz)),
  );
  const indexes = await quizzes.listIndexes().toArray();
  const obsoleteIndexes = indexes
    .filter((index) => Object.hasOwn(index.key ?? {}, 'isPrivate'))
    .map((index) => index.name);
  return {
    ok:
      obsoletePrivacyFields === 0 &&
      invalidVisibility === 0 &&
      obsoleteSourceTypes === 0 &&
      insecurePremiumAssets === 0 &&
      invalidPremiumSourceKeys === 0 &&
      obsoleteIndexes.length === 0 &&
      activePersonalSources.size === personalQuizIds.length,
    obsoletePrivacyFields,
    invalidVisibility,
    obsoleteSourceTypes,
    insecurePremiumAssets,
    invalidPremiumSourceKeys,
    obsoleteIndexes,
    missingActivePublication: personalQuizIds.length - activePersonalSources.size,
  };
}

async function main() {
  const projectDir = process.cwd();
  loadEnvConfig(projectDir);
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    if (process.argv.includes('--verify')) {
      const result = await verifyPremiumQuizCatalog(db);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
    const result = await migratePremiumQuizCatalog(db, {
      apply: process.argv.includes('--apply'),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
