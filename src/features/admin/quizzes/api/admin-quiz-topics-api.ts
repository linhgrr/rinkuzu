import type { AdminQuizTopicDetailDto, AdminQuizTopicListDto } from '@/dtos/admin-quiz-topic';
import { fetchApiData } from '@/lib/api/client';
import {
  toAdminQuizTopicDetailViewModel,
  toAdminQuizTopicViewModels,
} from '@/features/admin/quizzes/mappers/admin-quiz-topics.mapper';
import type {
  AdminQuizTopicAssignInput,
  AdminQuizTopicDetailViewModel,
  AdminQuizTopicFormInput,
  AdminQuizTopicViewModel,
} from '@/features/admin/quizzes/types/admin-quiz-topics-view-model';

const TOPICS_PATH = '/api/admin/quiz-topics';
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

async function requestTopics(path: string, init: RequestInit): Promise<AdminQuizTopicViewModel[]> {
  return toAdminQuizTopicViewModels(await fetchApiData<AdminQuizTopicListDto>(path, init));
}

async function requestTopicDetail(
  path: string,
  init: RequestInit,
): Promise<AdminQuizTopicDetailViewModel> {
  return toAdminQuizTopicDetailViewModel(await fetchApiData<AdminQuizTopicDetailDto>(path, init));
}

/** Every topic in order (RIN-1248). */
export async function fetchAdminQuizTopics(
  signal?: AbortSignal,
): Promise<AdminQuizTopicViewModel[]> {
  return requestTopics(TOPICS_PATH, signal ? { signal } : {});
}

/** Create a draft topic; resolves to the new list. */
export async function createQuizTopic(
  input: AdminQuizTopicFormInput,
): Promise<AdminQuizTopicViewModel[]> {
  return requestTopics(TOPICS_PATH, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ ...input, locale: 'vi' }),
  });
}

/** Edit, publish or unpublish a topic; resolves to the new list. */
export async function updateQuizTopic(
  topicId: string,
  input: Partial<AdminQuizTopicFormInput> & { published?: boolean },
): Promise<AdminQuizTopicViewModel[]> {
  return requestTopics(`${TOPICS_PATH}/${topicId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
}

/** One topic with its quizzes in order. */
export async function fetchAdminQuizTopicDetail(
  topicId: string,
  signal?: AbortSignal,
): Promise<AdminQuizTopicDetailViewModel> {
  return requestTopicDetail(`${TOPICS_PATH}/${topicId}`, signal ? { signal } : {});
}

/** Add a public quiz to a topic; resolves to that topic with its quizzes. */
export async function assignQuizToTopic({
  topicId,
  ...body
}: AdminQuizTopicAssignInput): Promise<AdminQuizTopicDetailViewModel> {
  return requestTopicDetail(`${TOPICS_PATH}/${topicId}/quizzes`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** Move a quiz to a 1-based position in its topic. */
export async function reorderTopicQuiz(
  topicId: string,
  quizId: string,
  order: number,
): Promise<AdminQuizTopicDetailViewModel> {
  return requestTopicDetail(`${TOPICS_PATH}/${topicId}/quizzes/${quizId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ order }),
  });
}

/** Remove a quiz from its topic. */
export async function unassignTopicQuiz(
  topicId: string,
  quizId: string,
): Promise<AdminQuizTopicDetailViewModel> {
  return requestTopicDetail(`${TOPICS_PATH}/${topicId}/quizzes/${quizId}`, { method: 'DELETE' });
}
