import { describe, expect, it } from 'vitest';

import { getAuthRoutePolicy } from '@/lib/routing/auth-route-policy';

describe('getAuthRoutePolicy', () => {
  it.each([
    ['/dashboard', 'authenticated'],
    ['/dashboard/settings', 'authenticated'],
    ['/bookmarks', 'authenticated'],
    ['/my-quizzes/folder/123', 'authenticated'],
    ['/adaptive/upload', 'authenticated'],
    ['/adaptive/pipeline-debug', 'admin'],
    ['/adaptive/pipeline-debug/jobs/123', 'admin'],
    ['/checkout', 'authenticated'],
    ['/checkout/order', 'authenticated'],
    ['/admin', 'admin'],
    ['/admin/users', 'admin'],
    ['/login', 'public'],
    ['/dashboard-preview', 'public'],
    ['/explore', 'public'],
    ['/quizzes', 'public'],
    ['/try', 'public'],
    ['/try/pdf', 'public'],
    // RIN-1473: the create hub itself is public (guest hub); everything under it is not.
    ['/create', 'public'],
    ['/create/pdf', 'authenticated'],
    ['/create/mobile', 'authenticated'],
    ['/creates', 'public'],
  ])('classifies %s as %s', (pathname, expected) => {
    expect(getAuthRoutePolicy(pathname)).toBe(expected);
  });
});
