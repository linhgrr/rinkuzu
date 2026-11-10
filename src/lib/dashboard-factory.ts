import 'server-only';
import { cache } from 'react';
import type { DashboardBootstrapDto, DashboardStatsDto } from '@/dtos/dashboard';
import type { PostSignInTargetInput } from '@/interfaces/services/IDashboardService';
import { DashboardRepository } from '@/repositories/DashboardRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { DashboardService } from '@/services/dashboard/DashboardService';
import {
  BlogTryResolver,
  LandingStarterResolver,
  type BlogTryInput,
} from '@/services/quiz/landing-starter';

const dashboardRepository = new DashboardRepository();
const dashboardService = new DashboardService(
  dashboardRepository,
  new QuizRepository(),
  dashboardRepository,
);
const landingStarterResolver = new LandingStarterResolver(dashboardRepository);
const blogTryResolver = new BlogTryResolver(dashboardRepository, landingStarterResolver);

export const getDashboardBootstrapData = cache(
  async (userId: string): Promise<DashboardBootstrapDto> =>
    dashboardService.getBootstrapData(userId),
);

/** Locale-unprefixed href for the post-sign-in landing (RIN-913); never throws. */
export async function getPostSignInHref(input: PostSignInTargetInput): Promise<string> {
  return dashboardService.getPostSignInHref(input);
}

export async function getDashboardStats(userId: string): Promise<DashboardStatsDto> {
  return dashboardService.getStats(userId);
}

/** Locale-unprefixed href of the homepage play-first starter (RIN-1178); null when none; never throws. */
export async function getLandingStarterHref(locale: string): Promise<string | null> {
  return landingStarterResolver.resolveHref(locale);
}

/** Locale-unprefixed href behind a blog post's quiz card (RIN-1258); null when none; never throws. */
export async function getBlogTryHref(locale: string, input: BlogTryInput): Promise<string | null> {
  return blogTryResolver.resolveHref(locale, input);
}
