import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminAuditEntry,
  IAdminAuditRepository,
} from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  IStarterQuizAdminRepository,
  StarterQuizInsertInput,
  StarterQuizRowChange,
  StarterQuizRowRecord,
} from '@/interfaces/repositories/IStarterQuizAdminRepository';
import type {
  IStarterQuizReadRepository,
  StarterQuizCandidateRecord,
} from '@/interfaces/repositories/IStarterQuizReadRepository';
import { StarterQuizAdminService } from '@/services/admin/StarterQuizAdminService';

const { authMock, serviceRef } = vi.hoisted(() => ({
  authMock: vi.fn(),
  serviceRef: { current: undefined as unknown },
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/admin-starter-quiz-factory', () => ({
  getStarterQuizAdminService: () => serviceRef.current,
}));

import { GET, POST } from '@/app/api/admin/starter-quizzes/route';
import { DELETE, PATCH } from '@/app/api/admin/starter-quizzes/[id]/route';

const QUIZ_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const QUIZ_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const QUIZ_C = 'cccccccccccccccccccccccc';
const QUIZ_NEW = 'dddddddddddddddddddddddd';
const QUIZ_PRIVATE = 'eeeeeeeeeeeeeeeeeeeeeeee';
const QUIZ_PREMIUM = 'ffffffffffffffffffffffff';
const QUIZ_GONE = '111111111111111111111111';
const QUIZ_FLAGGED = '222222222222222222222222';
const QUIZ_HELD = '333333333333333333333333';
const ROW_A = '0000000000000000000000a1';
const ROW_B = '0000000000000000000000b1';
const ROW_C = '0000000000000000000000c1';

const ADMIN = { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };

class FakeStarterRepository implements IStarterQuizAdminRepository {
  rows: StarterQuizRowRecord[] = [];
  private nextId = 1;

  async listStarterQuizRows(): Promise<StarterQuizRowRecord[]> {
    return [...this.rows].sort((a, b) => a.order - b.order).map((row) => ({ ...row }));
  }

  async insertStarterQuiz(input: StarterQuizInsertInput): Promise<StarterQuizRowRecord | null> {
    if (this.rows.some((row) => row.quizId === input.quizId)) return null;
    const row = {
      id: input.id ?? String(this.nextId++).padStart(24, '9'),
      quizId: input.quizId,
      locale: input.locale,
      order: input.order,
    };
    this.rows.push(row);
    return { ...row };
  }

  async updateStarterQuizRows(changes: readonly StarterQuizRowChange[]): Promise<void> {
    for (const change of changes) {
      const row = this.rows.find(({ id }) => id === change.id);
      if (!row) continue;
      if (change.locale !== undefined) row.locale = change.locale;
      if (change.order !== undefined) row.order = change.order;
    }
  }

  async deleteStarterQuiz(id: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row.id !== id);
    return this.rows.length < before;
  }
}

function candidate(
  quizId: string,
  overrides: Partial<StarterQuizCandidateRecord> = {},
): StarterQuizCandidateRecord {
  return {
    quizId,
    slug: 'fake-' + quizId.slice(0, 3),
    title: 'Fake quiz ' + quizId.slice(0, 3),
    visibility: 'public',
    questionCount: 8,
    isPremium: false,
    personalDataFlagged: false,
    indexHold: false,
    ...overrides,
  };
}

const CANDIDATES = [
  candidate(QUIZ_A),
  candidate(QUIZ_B, { questionCount: 40 }),
  candidate(QUIZ_C),
  candidate(QUIZ_NEW),
  candidate(QUIZ_PRIVATE, { visibility: 'personal' }),
  candidate(QUIZ_PREMIUM, { isPremium: true }),
  candidate(QUIZ_FLAGGED, { personalDataFlagged: true }),
  candidate(QUIZ_HELD, { indexHold: true }),
];

const candidateRepository: IStarterQuizReadRepository = {
  listStarterQuizEntries: async () => [],
  findStarterQuizCandidates: async (ids) => CANDIDATES.filter(({ quizId }) => ids.includes(quizId)),
};

let starters: FakeStarterRepository;
let auditEntries: AdminAuditEntry[];
let auditRecord: ReturnType<typeof vi.fn<IAdminAuditRepository['record']>>;

function jsonRequest(method: string, path: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/starter-quizzes' + path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
  });
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

const noParams = { params: Promise.resolve({}) };

function ordered(): Array<[string, number, string]> {
  return [...starters.rows]
    .sort((a, b) => a.order - b.order)
    .map(({ quizId, order, locale }) => [quizId, order, locale]);
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(ADMIN);
  starters = new FakeStarterRepository();
  starters.rows = [
    { id: ROW_A, quizId: QUIZ_A, locale: 'vi', order: 1 },
    { id: ROW_B, quizId: QUIZ_B, locale: 'en', order: 2 },
    { id: ROW_C, quizId: QUIZ_C, locale: 'vi', order: 3 },
  ];
  auditEntries = [];
  auditRecord = vi.fn(async (entry: AdminAuditEntry) => {
    auditEntries.push(entry);
  });
  serviceRef.current = new StarterQuizAdminService({
    starterRepository: starters,
    candidateRepository,
    auditRepository: { record: auditRecord },
  });
});

describe('admin starter quiz routes: auth', () => {
  const calls = [
    ['GET', () => GET(jsonRequest('GET', ''), noParams)],
    ['POST', () => POST(jsonRequest('POST', '', { quizId: QUIZ_NEW, locale: 'vi' }), noParams)],
    ['PATCH', () => PATCH(jsonRequest('PATCH', '/' + ROW_A, { order: 2 }), idContext(ROW_A))],
    ['DELETE', () => DELETE(jsonRequest('DELETE', '/' + ROW_A), idContext(ROW_A))],
  ] as const;

  it.each(calls)('%s returns 401 when signed out and changes nothing', async (_method, call) => {
    authMock.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(starters.rows).toHaveLength(3);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each(calls)('%s returns 403 for a non-admin and changes nothing', async (_method, call) => {
    authMock.mockResolvedValue({ user: { id: 'user-1', email: 'u@example.com', role: 'user' } });
    const response = await call();
    expect(response.status).toBe(403);
    expect(ordered()).toEqual([
      [QUIZ_A, 1, 'vi'],
      [QUIZ_B, 2, 'en'],
      [QUIZ_C, 3, 'vi'],
    ]);
    expect(auditRecord).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/starter-quizzes', () => {
  it('lists starters in order with live status, real counts and quick rounds', async () => {
    const response = await GET(jsonRequest('GET', ''), noParams);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toEqual([
      {
        id: ROW_A,
        quizId: QUIZ_A,
        slug: 'fake-aaa',
        title: 'Fake quiz aaa',
        questionCount: 8,
        locale: 'vi',
        order: 1,
        quick: false,
        status: 'live',
      },
      expect.objectContaining({ quizId: QUIZ_B, questionCount: 40, quick: true, status: 'live' }),
      expect.objectContaining({ quizId: QUIZ_C, order: 3, status: 'live' }),
    ]);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('returns dropped + the dashboard drop reason for entries the dashboard skips', async () => {
    starters.rows = [
      { id: ROW_A, quizId: QUIZ_GONE, locale: 'vi', order: 1 },
      { id: ROW_B, quizId: QUIZ_PRIVATE, locale: 'vi', order: 2 },
      { id: ROW_C, quizId: QUIZ_PREMIUM, locale: 'en', order: 3 },
    ];
    const body = await (await GET(jsonRequest('GET', ''), noParams)).json();
    expect(body.data.items).toEqual([
      expect.objectContaining({
        quizId: QUIZ_GONE,
        slug: null,
        title: null,
        status: 'dropped',
        dropReason: 'missing',
      }),
      expect.objectContaining({
        quizId: QUIZ_PRIVATE,
        status: 'dropped',
        dropReason: 'not-public',
      }),
      expect.objectContaining({ quizId: QUIZ_PREMIUM, status: 'dropped', dropReason: 'premium' }),
    ]);
  });

  // RIN-1408: the dashboard and landing skip these since RIN-1341; the list must not call them live.
  it('returns dropped for a starter flagged for personal data or under a report hold', async () => {
    starters.rows = [
      { id: ROW_A, quizId: QUIZ_FLAGGED, locale: 'vi', order: 1 },
      { id: ROW_B, quizId: QUIZ_HELD, locale: 'en', order: 2 },
    ];
    const body = await (await GET(jsonRequest('GET', ''), noParams)).json();
    expect(body.data.items).toEqual([
      expect.objectContaining({
        quizId: QUIZ_FLAGGED,
        status: 'dropped',
        dropReason: 'personal-data',
      }),
      expect.objectContaining({ quizId: QUIZ_HELD, status: 'dropped', dropReason: 'held' }),
    ]);
  });
});

describe('POST /api/admin/starter-quizzes', () => {
  it('marks a public free quiz last by default and records starter_quiz.marked', async () => {
    const response = await POST(
      jsonRequest('POST', '', { quizId: QUIZ_NEW, locale: 'en' }),
      noParams,
    );
    expect(response.status).toBe(201);
    expect(ordered()).toEqual([
      [QUIZ_A, 1, 'vi'],
      [QUIZ_B, 2, 'en'],
      [QUIZ_C, 3, 'vi'],
      [QUIZ_NEW, 4, 'en'],
    ]);
    expect(auditEntries).toEqual([
      {
        actorId: 'admin-1',
        actorEmail: 'admin@example.com',
        action: 'starter_quiz.marked',
        entityType: 'quiz',
        entityId: QUIZ_NEW,
        details: { locale: 'en', order: '4' },
      },
    ]);
    const body = await response.json();
    expect(body.data.items).toHaveLength(4);
  });

  it('inserts at a requested position and shifts the rest, keeping orders dense', async () => {
    await POST(jsonRequest('POST', '', { quizId: QUIZ_NEW, locale: 'vi', order: 2 }), noParams);
    expect(ordered()).toEqual([
      [QUIZ_A, 1, 'vi'],
      [QUIZ_NEW, 2, 'vi'],
      [QUIZ_B, 3, 'en'],
      [QUIZ_C, 4, 'vi'],
    ]);
    expect(auditEntries).toHaveLength(1);
  });

  it.each([
    ['missing', QUIZ_GONE],
    ['not public', QUIZ_PRIVATE],
    ['premium', QUIZ_PREMIUM],
    ['flagged', QUIZ_FLAGGED],
    ['held', QUIZ_HELD],
  ])('returns 422 for a %s quiz and writes nothing', async (_label, quizId) => {
    const response = await POST(jsonRequest('POST', '', { quizId, locale: 'vi' }), noParams);
    expect(response.status).toBe(422);
    expect(starters.rows).toHaveLength(3);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('returns 409 when the quiz is already a starter', async () => {
    const response = await POST(
      jsonRequest('POST', '', { quizId: QUIZ_B, locale: 'vi' }),
      noParams,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'conflict' } });
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown locale', { quizId: QUIZ_NEW, locale: 'fr' }],
    ['an invalid quiz id', { quizId: 'nope', locale: 'vi' }],
    ['order 0', { quizId: QUIZ_NEW, locale: 'vi', order: 0 }],
    ['extra fields', { quizId: QUIZ_NEW, locale: 'vi', slug: 'x' }],
    ['malformed JSON', '{not json'],
  ])('returns 400 for %s', async (_label, body) => {
    const response = await POST(jsonRequest('POST', '', body), noParams);
    expect(response.status).toBe(400);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('undoes the mark and returns 500 when the audit write fails', async () => {
    auditRecord.mockRejectedValueOnce(new Error('audit down'));
    const response = await POST(
      jsonRequest('POST', '', { quizId: QUIZ_NEW, locale: 'vi', order: 1 }),
      noParams,
    );
    expect(response.status).toBe(500);
    expect(ordered()).toEqual([
      [QUIZ_A, 1, 'vi'],
      [QUIZ_B, 2, 'en'],
      [QUIZ_C, 3, 'vi'],
    ]);
  });
});

describe('PATCH /api/admin/starter-quizzes/[id]', () => {
  it('moves a starter to a position and records starter_quiz.reordered', async () => {
    const response = await PATCH(jsonRequest('PATCH', '/' + ROW_C, { order: 1 }), idContext(ROW_C));
    expect(response.status).toBe(200);
    expect(ordered()).toEqual([
      [QUIZ_C, 1, 'vi'],
      [QUIZ_A, 2, 'vi'],
      [QUIZ_B, 3, 'en'],
    ]);
    expect(auditEntries).toEqual([
      expect.objectContaining({
        action: 'starter_quiz.reordered',
        entityType: 'quiz',
        entityId: QUIZ_C,
        details: { locale: 'vi', order: '1', previousLocale: 'vi', previousOrder: '3' },
      }),
    ]);
  });

  it('changes the locale and records starter_quiz.updated', async () => {
    await PATCH(jsonRequest('PATCH', '/' + ROW_A, { locale: 'en' }), idContext(ROW_A));
    expect(ordered()).toEqual([
      [QUIZ_A, 1, 'en'],
      [QUIZ_B, 2, 'en'],
      [QUIZ_C, 3, 'vi'],
    ]);
    expect(auditEntries).toEqual([
      expect.objectContaining({ action: 'starter_quiz.updated', entityId: QUIZ_A }),
    ]);
  });

  it('clamps a position past the end to last', async () => {
    await PATCH(jsonRequest('PATCH', '/' + ROW_A, { order: 99 }), idContext(ROW_A));
    expect(ordered().map(([quizId, order]) => [quizId, order])).toEqual([
      [QUIZ_B, 1],
      [QUIZ_C, 2],
      [QUIZ_A, 3],
    ]);
  });

  it('records nothing when the patch changes nothing', async () => {
    const response = await PATCH(
      jsonRequest('PATCH', '/' + ROW_B, { order: 2, locale: 'en' }),
      idContext(ROW_B),
    );
    expect(response.status).toBe(200);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown starter id', async () => {
    const unknown = '222222222222222222222222';
    const response = await PATCH(
      jsonRequest('PATCH', '/' + unknown, { order: 1 }),
      idContext(unknown),
    );
    expect(response.status).toBe(404);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty body', {}],
    ['an unknown locale', { locale: 'fr' }],
    ['extra fields', { order: 1, quizId: QUIZ_A }],
  ])('returns 400 for %s', async (_label, body) => {
    const response = await PATCH(jsonRequest('PATCH', '/' + ROW_A, body), idContext(ROW_A));
    expect(response.status).toBe(400);
  });

  it('returns 400 for an invalid starter id', async () => {
    const response = await PATCH(jsonRequest('PATCH', '/x', { order: 1 }), idContext('x'));
    expect(response.status).toBe(400);
  });

  it('restores the previous order when the audit write fails', async () => {
    auditRecord.mockRejectedValueOnce(new Error('audit down'));
    const response = await PATCH(
      jsonRequest('PATCH', '/' + ROW_C, { order: 1, locale: 'en' }),
      idContext(ROW_C),
    );
    expect(response.status).toBe(500);
    expect(ordered()).toEqual([
      [QUIZ_A, 1, 'vi'],
      [QUIZ_B, 2, 'en'],
      [QUIZ_C, 3, 'vi'],
    ]);
  });
});

describe('DELETE /api/admin/starter-quizzes/[id]', () => {
  it('unmarks, closes the gap and records starter_quiz.unmarked', async () => {
    const response = await DELETE(jsonRequest('DELETE', '/' + ROW_A), idContext(ROW_A));
    expect(response.status).toBe(200);
    expect(ordered()).toEqual([
      [QUIZ_B, 1, 'en'],
      [QUIZ_C, 2, 'vi'],
    ]);
    expect(auditEntries).toEqual([
      {
        actorId: 'admin-1',
        actorEmail: 'admin@example.com',
        action: 'starter_quiz.unmarked',
        entityType: 'quiz',
        entityId: QUIZ_A,
        details: { locale: 'vi', order: '1' },
      },
    ]);
  });

  it('returns 404 for an unknown starter id', async () => {
    const unknown = '222222222222222222222222';
    const response = await DELETE(jsonRequest('DELETE', '/' + unknown), idContext(unknown));
    expect(response.status).toBe(404);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('puts the starter back when the audit write fails', async () => {
    auditRecord.mockRejectedValueOnce(new Error('audit down'));
    const response = await DELETE(jsonRequest('DELETE', '/' + ROW_A), idContext(ROW_A));
    expect(response.status).toBe(500);
    expect(ordered()).toEqual([
      [QUIZ_A, 1, 'vi'],
      [QUIZ_B, 2, 'en'],
      [QUIZ_C, 3, 'vi'],
    ]);
    expect(starters.rows.find(({ quizId }) => quizId === QUIZ_A)?.id).toBe(ROW_A);
  });
});
