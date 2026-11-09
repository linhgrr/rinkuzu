import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminAuditEntry,
  IAdminAuditRepository,
} from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  IQuizTopicAdminRepository,
  QuizTopicAssignmentInsertInput,
  QuizTopicAssignmentOrderChange,
  QuizTopicAssignmentRecord,
  QuizTopicChange,
  QuizTopicInsertInput,
  QuizTopicRecord,
} from '@/interfaces/repositories/IQuizTopicAdminRepository';
import type {
  IStarterQuizReadRepository,
  StarterQuizCandidateRecord,
} from '@/interfaces/repositories/IStarterQuizReadRepository';
import { QuizTopicAdminService } from '@/services/admin/QuizTopicAdminService';

const { authMock, serviceRef } = vi.hoisted(() => ({
  authMock: vi.fn(),
  serviceRef: { current: undefined as unknown },
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/admin-quiz-topic-factory', () => ({
  getQuizTopicAdminService: () => serviceRef.current,
}));

import { GET, POST } from '@/app/api/admin/quiz-topics/route';
import { GET as GET_TOPIC, PATCH } from '@/app/api/admin/quiz-topics/[id]/route';
import { POST as ASSIGN } from '@/app/api/admin/quiz-topics/[id]/quizzes/route';
import {
  DELETE as UNASSIGN,
  PATCH as REORDER,
} from '@/app/api/admin/quiz-topics/[id]/quizzes/[quizId]/route';

const TOPIC_HOA = '0000000000000000000000a1';
const TOPIC_SINH = '0000000000000000000000b1';
const QUIZ_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const QUIZ_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const QUIZ_C = 'cccccccccccccccccccccccc';
const QUIZ_PRIVATE = 'eeeeeeeeeeeeeeeeeeeeeeee';
const QUIZ_GONE = '111111111111111111111111';
const UNKNOWN = '222222222222222222222222';

const ADMIN = { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => 'chu' + i).join(' ');
}

function nextId(n: number): string {
  return String(n).padStart(24, '9');
}

class FakeTopicRepository implements IQuizTopicAdminRepository {
  topics: QuizTopicRecord[] = [];
  assignments: QuizTopicAssignmentRecord[] = [];
  private counter = 1;

  async listTopics(): Promise<QuizTopicRecord[]> {
    return [...this.topics].sort((a, b) => a.order - b.order).map((topic) => ({ ...topic }));
  }

  async insertTopic(input: QuizTopicInsertInput): Promise<QuizTopicRecord | null> {
    if (this.topics.some(({ slug }) => slug === input.slug)) return null;
    const { actorId: _actorId, ...fields } = input;
    const topic = { ...fields, id: nextId(this.counter++), published: false };
    this.topics.push(topic);
    return { ...topic };
  }

  async updateTopics(changes: readonly QuizTopicChange[]): Promise<boolean> {
    for (const { id, ...fields } of changes) {
      if (fields.slug && this.topics.some((t) => t.slug === fields.slug && t.id !== id)) {
        return false;
      }
      const topic = this.topics.find((t) => t.id === id);
      if (topic) Object.assign(topic, fields);
    }
    return true;
  }

  async deleteTopic(id: string): Promise<boolean> {
    const before = this.topics.length;
    this.topics = this.topics.filter((topic) => topic.id !== id);
    return this.topics.length < before;
  }

  async countAssignmentsByTopic(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const { topicId } of this.assignments) counts.set(topicId, (counts.get(topicId) ?? 0) + 1);
    return counts;
  }

  async listAssignments(topicId: string): Promise<QuizTopicAssignmentRecord[]> {
    return this.assignments
      .filter((row) => row.topicId === topicId)
      .sort((a, b) => a.order - b.order)
      .map((row) => ({ ...row }));
  }

  async findAssignmentByQuiz(quizId: string): Promise<QuizTopicAssignmentRecord | null> {
    const row = this.assignments.find((a) => a.quizId === quizId);
    return row ? { ...row } : null;
  }

  async insertAssignment(
    input: QuizTopicAssignmentInsertInput,
  ): Promise<QuizTopicAssignmentRecord | null> {
    if (this.assignments.some(({ quizId }) => quizId === input.quizId)) return null;
    const row = {
      id: input.id ?? nextId(this.counter++),
      quizId: input.quizId,
      topicId: input.topicId,
      order: input.order,
    };
    this.assignments.push(row);
    return { ...row };
  }

  async updateAssignmentOrders(changes: readonly QuizTopicAssignmentOrderChange[]): Promise<void> {
    for (const { id, order } of changes) {
      const row = this.assignments.find((a) => a.id === id);
      if (row) row.order = order;
    }
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const before = this.assignments.length;
    this.assignments = this.assignments.filter((row) => row.id !== id);
    return this.assignments.length < before;
  }
}

function quiz(
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

const QUIZZES = [
  quiz(QUIZ_A),
  quiz(QUIZ_B),
  quiz(QUIZ_C),
  quiz(QUIZ_PRIVATE, { visibility: 'personal' }),
];

const quizRepository: IStarterQuizReadRepository = {
  listStarterQuizEntries: async () => [],
  findStarterQuizCandidates: async (ids) => QUIZZES.filter(({ quizId }) => ids.includes(quizId)),
};

let repo: FakeTopicRepository;
let auditEntries: AdminAuditEntry[];
let auditRecord: ReturnType<typeof vi.fn<IAdminAuditRepository['record']>>;

function jsonRequest(method: string, path: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/quiz-topics' + path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
  });
}

const noParams = { params: Promise.resolve({}) };

function topicContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function topicQuizContext(id: string, quizId: string) {
  return { params: Promise.resolve({ id, quizId }) };
}

function topicOrder(): Array<[string, number]> {
  return [...repo.topics].sort((a, b) => a.order - b.order).map(({ slug, order }) => [slug, order]);
}

function assignmentOrder(topicId = TOPIC_HOA): Array<[string, number]> {
  return repo.assignments
    .filter((row) => row.topicId === topicId)
    .sort((a, b) => a.order - b.order)
    .map(({ quizId, order }) => [quizId, order]);
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(ADMIN);
  repo = new FakeTopicRepository();
  repo.topics = [
    {
      id: TOPIC_HOA,
      slug: 'hoa-hoc-12',
      locale: 'vi',
      name: 'Hóa học 12',
      intro: words(150),
      order: 1,
      published: true,
    },
    {
      id: TOPIC_SINH,
      slug: 'sinh-hoc',
      locale: 'vi',
      name: 'Sinh học',
      intro: 'Bản nháp',
      order: 2,
      published: false,
    },
  ];
  repo.assignments = [
    { id: nextId(901), quizId: QUIZ_A, topicId: TOPIC_HOA, order: 1 },
    { id: nextId(902), quizId: QUIZ_B, topicId: TOPIC_HOA, order: 2 },
  ];
  auditEntries = [];
  auditRecord = vi.fn(async (entry: AdminAuditEntry) => {
    auditEntries.push(entry);
  });
  serviceRef.current = new QuizTopicAdminService({
    topicRepository: repo,
    quizRepository,
    auditRepository: { record: auditRecord },
  });
});

describe('admin quiz topic routes: auth', () => {
  const calls = [
    ['GET list', () => GET(jsonRequest('GET', ''), noParams)],
    ['POST create', () => POST(jsonRequest('POST', '', { slug: 'toan', name: 'Toán' }), noParams)],
    ['GET topic', () => GET_TOPIC(jsonRequest('GET', '/x'), topicContext(TOPIC_HOA))],
    [
      'PATCH topic',
      () => PATCH(jsonRequest('PATCH', '/x', { published: false }), topicContext(TOPIC_HOA)),
    ],
    [
      'POST assign',
      () => ASSIGN(jsonRequest('POST', '/x', { quizId: QUIZ_C }), topicContext(TOPIC_HOA)),
    ],
    [
      'PATCH reorder',
      () => REORDER(jsonRequest('PATCH', '/x', { order: 1 }), topicQuizContext(TOPIC_HOA, QUIZ_B)),
    ],
    [
      'DELETE unassign',
      () => UNASSIGN(jsonRequest('DELETE', '/x'), topicQuizContext(TOPIC_HOA, QUIZ_A)),
    ],
  ] as const;

  it.each(calls)('%s returns 401 when signed out and changes nothing', async (_label, call) => {
    authMock.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(repo.topics).toHaveLength(2);
    expect(repo.assignments).toHaveLength(2);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each(calls)('%s returns 403 for a non-admin and changes nothing', async (_label, call) => {
    authMock.mockResolvedValue({ user: { id: 'user-1', email: 'u@example.com', role: 'user' } });
    expect((await call()).status).toBe(403);
    expect(topicOrder()).toEqual([
      ['hoa-hoc-12', 1],
      ['sinh-hoc', 2],
    ]);
    expect(assignmentOrder()).toEqual([
      [QUIZ_A, 1],
      [QUIZ_B, 2],
    ]);
    expect(auditRecord).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/quiz-topics', () => {
  it('lists topics in order with word and quiz counts, and audits nothing', async () => {
    const response = await GET(jsonRequest('GET', ''), noParams);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toEqual([
      expect.objectContaining({
        id: TOPIC_HOA,
        slug: 'hoa-hoc-12',
        introWords: 150,
        published: true,
        quizCount: 2,
      }),
      expect.objectContaining({ id: TOPIC_SINH, introWords: 2, published: false, quizCount: 0 }),
    ]);
    expect(auditRecord).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/quiz-topics', () => {
  it('creates a draft last by default and records quiz_topic.created', async () => {
    const response = await POST(
      jsonRequest('POST', '', { slug: 'toan-lop-10', name: 'Toán lớp 10' }),
      noParams,
    );
    expect(response.status).toBe(201);
    expect(topicOrder()).toEqual([
      ['hoa-hoc-12', 1],
      ['sinh-hoc', 2],
      ['toan-lop-10', 3],
    ]);
    const created = repo.topics.find(({ slug }) => slug === 'toan-lop-10');
    expect(created).toMatchObject({ locale: 'vi', intro: '', published: false });
    expect(auditEntries).toEqual([
      {
        actorId: 'admin-1',
        actorEmail: 'admin@example.com',
        action: 'quiz_topic.created',
        entityType: 'quiz_topic',
        entityId: created?.id,
        details: { slug: 'toan-lop-10', locale: 'vi', order: '3' },
      },
    ]);
  });

  it('inserts at a requested position and shifts the rest', async () => {
    await POST(jsonRequest('POST', '', { slug: 'toan', name: 'Toán', order: 1 }), noParams);
    expect(topicOrder()).toEqual([
      ['toan', 1],
      ['hoa-hoc-12', 2],
      ['sinh-hoc', 3],
    ]);
  });

  it('returns 409 for a slug already used', async () => {
    const response = await POST(
      jsonRequest('POST', '', { slug: 'sinh-hoc', name: 'Sinh 2' }),
      noParams,
    );
    expect(response.status).toBe(409);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-ASCII slug', { slug: 'hóa-học', name: 'Hóa' }],
    ['an upper-case slug', { slug: 'Hoa', name: 'Hóa' }],
    ['an unknown locale', { slug: 'hoa', name: 'Hóa', locale: 'en' }],
    ['a missing name', { slug: 'hoa' }],
    ['a published flag on create', { slug: 'hoa', name: 'Hóa', published: true }],
    ['malformed JSON', '{not json'],
  ])('returns 400 for %s', async (_label, body) => {
    expect((await POST(jsonRequest('POST', '', body), noParams)).status).toBe(400);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('removes the topic again and returns 500 when the audit write fails', async () => {
    auditRecord.mockRejectedValueOnce(new Error('audit down'));
    const response = await POST(
      jsonRequest('POST', '', { slug: 'toan', name: 'Toán', order: 1 }),
      noParams,
    );
    expect(response.status).toBe(500);
    expect(topicOrder()).toEqual([
      ['hoa-hoc-12', 1],
      ['sinh-hoc', 2],
    ]);
  });
});

describe('PATCH /api/admin/quiz-topics/[id]', () => {
  it('publishes a topic with a 120-400 word intro and records quiz_topic.published', async () => {
    const response = await PATCH(
      jsonRequest('PATCH', '/x', { intro: words(200), published: true }),
      topicContext(TOPIC_SINH),
    );
    expect(response.status).toBe(200);
    expect(repo.topics.find(({ id }) => id === TOPIC_SINH)).toMatchObject({ published: true });
    expect(auditEntries).toEqual([
      expect.objectContaining({
        action: 'quiz_topic.published',
        entityType: 'quiz_topic',
        entityId: TOPIC_SINH,
        details: {
          fields: 'intro,published',
          slug: 'sinh-hoc',
          previousSlug: 'sinh-hoc',
          published: 'true',
          order: '2',
        },
      }),
    ]);
    expect(JSON.stringify(auditEntries)).not.toContain('chu0');
  });

  it.each([
    ['publishing a draft with a short intro', TOPIC_SINH, { published: true }],
    ['shortening a published intro', TOPIC_HOA, { intro: words(50) }],
    ['publishing a 401-word intro', TOPIC_SINH, { intro: words(401), published: true }],
  ])('returns 422 for %s and writes nothing', async (_label, id, body) => {
    const before = JSON.stringify(repo.topics);
    const response = await PATCH(jsonRequest('PATCH', '/x', body), topicContext(id));
    expect(response.status).toBe(422);
    expect(JSON.stringify(repo.topics)).toBe(before);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('saves a short intro on a draft', async () => {
    const response = await PATCH(
      jsonRequest('PATCH', '/x', { intro: 'Ngắn thôi' }),
      topicContext(TOPIC_SINH),
    );
    expect(response.status).toBe(200);
    expect(auditEntries).toEqual([expect.objectContaining({ action: 'quiz_topic.updated' })]);
  });

  it('unpublishes and records quiz_topic.unpublished', async () => {
    await PATCH(jsonRequest('PATCH', '/x', { published: false }), topicContext(TOPIC_HOA));
    expect(repo.topics.find(({ id }) => id === TOPIC_HOA)?.published).toBe(false);
    expect(auditEntries).toEqual([expect.objectContaining({ action: 'quiz_topic.unpublished' })]);
  });

  it('moves a topic and renumbers the rest', async () => {
    await PATCH(jsonRequest('PATCH', '/x', { order: 1 }), topicContext(TOPIC_SINH));
    expect(topicOrder()).toEqual([
      ['sinh-hoc', 1],
      ['hoa-hoc-12', 2],
    ]);
  });

  it('returns 409 when the new slug is taken', async () => {
    const response = await PATCH(
      jsonRequest('PATCH', '/x', { slug: 'sinh-hoc' }),
      topicContext(TOPIC_HOA),
    );
    expect(response.status).toBe(409);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('records nothing when the patch changes nothing', async () => {
    const response = await PATCH(
      jsonRequest('PATCH', '/x', { name: 'Sinh học', order: 2 }),
      topicContext(TOPIC_SINH),
    );
    expect(response.status).toBe(200);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown topic and 400 for an empty body or bad id', async () => {
    const missing = await PATCH(jsonRequest('PATCH', '/x', { order: 1 }), topicContext(UNKNOWN));
    expect(missing.status).toBe(404);
    expect((await PATCH(jsonRequest('PATCH', '/x', {}), topicContext(TOPIC_HOA))).status).toBe(400);
    expect((await PATCH(jsonRequest('PATCH', '/x', { order: 1 }), topicContext('x'))).status).toBe(
      400,
    );
  });

  it('restores the topic when the audit write fails', async () => {
    auditRecord.mockRejectedValueOnce(new Error('audit down'));
    const response = await PATCH(
      jsonRequest('PATCH', '/x', { slug: 'sinh', name: 'Sinh', order: 1 }),
      topicContext(TOPIC_SINH),
    );
    expect(response.status).toBe(500);
    expect(repo.topics.find(({ id }) => id === TOPIC_SINH)).toMatchObject({
      slug: 'sinh-hoc',
      name: 'Sinh học',
      order: 2,
    });
    expect(topicOrder()).toEqual([
      ['hoa-hoc-12', 1],
      ['sinh-hoc', 2],
    ]);
  });
});

describe('GET /api/admin/quiz-topics/[id]', () => {
  it('returns the topic with its quizzes in order', async () => {
    repo.assignments.push({ id: nextId(903), quizId: QUIZ_GONE, topicId: TOPIC_HOA, order: 3 });
    const response = await GET_TOPIC(jsonRequest('GET', '/x'), topicContext(TOPIC_HOA));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.topic).toMatchObject({ id: TOPIC_HOA, quizCount: 3 });
    expect(body.data.quizzes).toEqual([
      {
        quizId: QUIZ_A,
        order: 1,
        slug: 'fake-aaa',
        title: 'Fake quiz aaa',
        questionCount: 8,
        isPublic: true,
      },
      expect.objectContaining({ quizId: QUIZ_B, order: 2 }),
      { quizId: QUIZ_GONE, order: 3, slug: null, title: null, questionCount: 0, isPublic: false },
    ]);
  });

  it('returns 404 for an unknown topic', async () => {
    expect((await GET_TOPIC(jsonRequest('GET', '/x'), topicContext(UNKNOWN))).status).toBe(404);
  });
});

describe('POST /api/admin/quiz-topics/[id]/quizzes', () => {
  it('assigns a public quiz last and records quiz_topic.quiz_assigned', async () => {
    const response = await ASSIGN(
      jsonRequest('POST', '/x', { quizId: QUIZ_C }),
      topicContext(TOPIC_HOA),
    );
    expect(response.status).toBe(201);
    expect(assignmentOrder()).toEqual([
      [QUIZ_A, 1],
      [QUIZ_B, 2],
      [QUIZ_C, 3],
    ]);
    expect(auditEntries).toEqual([
      {
        actorId: 'admin-1',
        actorEmail: 'admin@example.com',
        action: 'quiz_topic.quiz_assigned',
        entityType: 'quiz_topic',
        entityId: TOPIC_HOA,
        details: { quizId: QUIZ_C, order: '3' },
      },
    ]);
    const body = await response.json();
    expect(body.data.quizzes).toHaveLength(3);
  });

  it('inserts at a requested position and shifts the rest', async () => {
    await ASSIGN(jsonRequest('POST', '/x', { quizId: QUIZ_C, order: 1 }), topicContext(TOPIC_HOA));
    expect(assignmentOrder()).toEqual([
      [QUIZ_C, 1],
      [QUIZ_A, 2],
      [QUIZ_B, 3],
    ]);
  });

  it('returns 422 for a private quiz and writes nothing', async () => {
    const response = await ASSIGN(
      jsonRequest('POST', '/x', { quizId: QUIZ_PRIVATE }),
      topicContext(TOPIC_HOA),
    );
    expect(response.status).toBe(422);
    expect(repo.assignments).toHaveLength(2);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('returns 409 when the quiz already has a topic, even a different one', async () => {
    const response = await ASSIGN(
      jsonRequest('POST', '/x', { quizId: QUIZ_A }),
      topicContext(TOPIC_SINH),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'conflict' } });
    expect(assignmentOrder(TOPIC_SINH)).toEqual([]);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing quiz or topic', async () => {
    const gone = await ASSIGN(
      jsonRequest('POST', '/x', { quizId: QUIZ_GONE }),
      topicContext(TOPIC_HOA),
    );
    expect(gone.status).toBe(404);
    const noTopic = await ASSIGN(
      jsonRequest('POST', '/x', { quizId: QUIZ_C }),
      topicContext(UNKNOWN),
    );
    expect(noTopic.status).toBe(404);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each([
    ['an invalid quiz id', { quizId: 'nope' }],
    ['order 0', { quizId: QUIZ_C, order: 0 }],
    ['extra fields', { quizId: QUIZ_C, topicId: TOPIC_SINH }],
  ])('returns 400 for %s', async (_label, body) => {
    expect((await ASSIGN(jsonRequest('POST', '/x', body), topicContext(TOPIC_HOA))).status).toBe(
      400,
    );
  });

  it('undoes the assignment when the audit write fails', async () => {
    auditRecord.mockRejectedValueOnce(new Error('audit down'));
    const response = await ASSIGN(
      jsonRequest('POST', '/x', { quizId: QUIZ_C, order: 1 }),
      topicContext(TOPIC_HOA),
    );
    expect(response.status).toBe(500);
    expect(assignmentOrder()).toEqual([
      [QUIZ_A, 1],
      [QUIZ_B, 2],
    ]);
  });
});

describe('PATCH /api/admin/quiz-topics/[id]/quizzes/[quizId]', () => {
  it('moves a quiz and records quiz_topic.quiz_reordered', async () => {
    const response = await REORDER(
      jsonRequest('PATCH', '/x', { order: 1 }),
      topicQuizContext(TOPIC_HOA, QUIZ_B),
    );
    expect(response.status).toBe(200);
    expect(assignmentOrder()).toEqual([
      [QUIZ_B, 1],
      [QUIZ_A, 2],
    ]);
    expect(auditEntries).toEqual([
      expect.objectContaining({
        action: 'quiz_topic.quiz_reordered',
        entityId: TOPIC_HOA,
        details: { quizId: QUIZ_B, order: '1', previousOrder: '2' },
      }),
    ]);
  });

  it('returns 404 for a quiz not in the topic', async () => {
    const response = await REORDER(
      jsonRequest('PATCH', '/x', { order: 1 }),
      topicQuizContext(TOPIC_SINH, QUIZ_A),
    );
    expect(response.status).toBe(404);
  });

  it('restores the order when the audit write fails', async () => {
    auditRecord.mockRejectedValueOnce(new Error('audit down'));
    const response = await REORDER(
      jsonRequest('PATCH', '/x', { order: 1 }),
      topicQuizContext(TOPIC_HOA, QUIZ_B),
    );
    expect(response.status).toBe(500);
    expect(assignmentOrder()).toEqual([
      [QUIZ_A, 1],
      [QUIZ_B, 2],
    ]);
  });
});

describe('DELETE /api/admin/quiz-topics/[id]/quizzes/[quizId]', () => {
  it('removes a quiz, closes the gap and records quiz_topic.quiz_unassigned', async () => {
    const response = await UNASSIGN(
      jsonRequest('DELETE', '/x'),
      topicQuizContext(TOPIC_HOA, QUIZ_A),
    );
    expect(response.status).toBe(200);
    expect(assignmentOrder()).toEqual([[QUIZ_B, 1]]);
    expect(auditEntries).toEqual([
      expect.objectContaining({
        action: 'quiz_topic.quiz_unassigned',
        details: { quizId: QUIZ_A, order: '1' },
      }),
    ]);
  });

  it('puts the quiz back under its old id when the audit write fails', async () => {
    auditRecord.mockRejectedValueOnce(new Error('audit down'));
    const response = await UNASSIGN(
      jsonRequest('DELETE', '/x'),
      topicQuizContext(TOPIC_HOA, QUIZ_A),
    );
    expect(response.status).toBe(500);
    expect(assignmentOrder()).toEqual([
      [QUIZ_A, 1],
      [QUIZ_B, 2],
    ]);
    expect(repo.assignments.find(({ quizId }) => quizId === QUIZ_A)?.id).toBe(nextId(901));
  });

  it('returns 404 for a quiz not in the topic', async () => {
    const response = await UNASSIGN(
      jsonRequest('DELETE', '/x'),
      topicQuizContext(TOPIC_HOA, QUIZ_C),
    );
    expect(response.status).toBe(404);
    expect(auditRecord).not.toHaveBeenCalled();
  });
});
