import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock, toAttemptDetailViewModelMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
  toAttemptDetailViewModelMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  fetchApiData: fetchApiDataMock,
}));

vi.mock('@/features/profile/mappers/attempt-detail.mapper', () => ({
  toAttemptDetailViewModel: toAttemptDetailViewModelMock,
}));

import { fetchAttemptDetailViewModel } from './attempt-detail-api';

const dto = {
  id: '507f191e810c19729de860ea',
  score: 80,
  quiz: { title: 'Algebra', slug: 'algebra', questions: [] },
};

const viewModel = {
  id: '507f191e810c19729de860ea',
  score: 80,
  scoreLabel: '80%',
  quiz: { title: 'Algebra', slug: 'algebra', questions: [] },
};

describe('fetchAttemptDetailViewModel', () => {
  afterEach(() => {
    fetchApiDataMock.mockReset();
    toAttemptDetailViewModelMock.mockReset();
  });

  it('loads authenticated attempt detail without a userEmail query param', async () => {
    fetchApiDataMock.mockResolvedValueOnce(dto);
    toAttemptDetailViewModelMock.mockReturnValueOnce(viewModel);

    await expect(fetchAttemptDetailViewModel('507f191e810c19729de860ea', 'en')).resolves.toBe(
      viewModel,
    );
    expect(fetchApiDataMock).toHaveBeenCalledWith(
      '/api/attempts/507f191e810c19729de860ea?locale=en',
    );
    expect(toAttemptDetailViewModelMock).toHaveBeenCalledWith(dto, 'en');
  });

  it('threads guest userEmail for guest attempt detail access', async () => {
    fetchApiDataMock.mockResolvedValueOnce(dto);
    toAttemptDetailViewModelMock.mockReturnValueOnce(viewModel);

    await expect(
      fetchAttemptDetailViewModel('507f191e810c19729de860ea', 'vi', {
        userEmail: 'guest@example.com',
      }),
    ).resolves.toBe(viewModel);
    expect(fetchApiDataMock).toHaveBeenCalledWith(
      '/api/attempts/507f191e810c19729de860ea?locale=vi&userEmail=guest%40example.com',
    );
  });

  it('sends a guest claim token in the header, never in the URL (RIN-912)', async () => {
    fetchApiDataMock.mockResolvedValueOnce(dto);
    toAttemptDetailViewModelMock.mockReturnValueOnce(viewModel);

    await fetchAttemptDetailViewModel('507f191e810c19729de860ea', 'en', {
      guestClaimToken: 'fake-token',
    });
    expect(fetchApiDataMock).toHaveBeenCalledWith(
      '/api/attempts/507f191e810c19729de860ea?locale=en',
      { headers: { 'x-guest-claim-token': 'fake-token' } },
    );
  });

  it('encodes attempt ids in the path segment', async () => {
    fetchApiDataMock.mockResolvedValueOnce(dto);
    toAttemptDetailViewModelMock.mockReturnValueOnce(viewModel);

    await fetchAttemptDetailViewModel('id with space', 'en');
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/attempts/id%20with%20space?locale=en');
  });
});
