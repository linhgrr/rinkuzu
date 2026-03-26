/**
 * llms.txt — LLM Content Discovery File
 *
 * This endpoint serves a text file that AI crawlers (ChatGPT, Claude, Gemini, Perplexity,
 * and other LLM-powered search tools) can discover and use to understand site content.
 *
 * Standard: https://llmstxt.gradient.ai/
 *
 * The file is generated dynamically from the latest site content and key descriptions.
 * Update this route whenever major content changes are made to the site.
 */

import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rinkuzu.app';
const SITE_NAME = 'RinKuzu';
const DESCRIPTION =
  'AI-powered adaptive learning platform that transforms PDF documents into personalized quiz-based learning journeys using knowledge graphs and Bloom\'s Taxonomy.';

const LLM_CONTENT = `# ${SITE_NAME}

## Site Description
${SITE_NAME} is an AI-powered adaptive learning platform. ${DESCRIPTION}

## What ${SITE_NAME} Does
1. Upload any PDF document (lecture notes, textbooks, internal docs)
2. AI automatically extracts key concepts and builds a knowledge graph
3. Identifies prerequisite relationships between concepts
4. Creates personalized quiz sessions matching your current level
5. Tracks mastery across Bloom's cognitive taxonomy levels (Remember → Create)
6. Provides adaptive practice that prioritizes weak concepts

## Primary Use Cases
- Students: Exam preparation, self-study, concept review
- Teachers: Auto-generate quizzes from existing materials, classroom review
- Training teams: Onboarding content, skill reinforcement
- Course creators: Content reuse and structured learning paths

## Key Features
- AI Quiz Generator from PDF: Upload once, get high-quality quizzes with explanations
- Knowledge Graph: Visual prerequisite map showing concept relationships
- Adaptive Practice: AI adjusts difficulty based on real-time performance
- Mastery Tracking: Accuracy, weak topics, and completion trends
- Bloom-Level Paths: Practice from recall to higher-order reasoning
- Bilingual: English and Vietnamese

## Pricing
- Free Plan: Basic PDF-to-quiz generation, practice, progress tracking, community support
- Premium Plan: Full adaptive learning access, advanced quiz features, priority support

## Contact
- Email: support@rinkuzu.com
- Website: ${SITE_URL}

## Key Pages
- / — Homepage and product overview
- /adaptive-learning — AI quiz generator feature page
- /pricing — Pricing plans
- /faq — Frequently asked questions
- /register — Create a free account
- /login — Sign in to existing account
- /explore — Browse community quizzes

## Technology
- Powered by Gemini AI
- Web application (no installation required)
- PWA-ready (installable on mobile/desktop)
`;

/**
 * GET /llms.txt
 *
 * Returns a plain-text file optimized for LLM content discovery.
 * This file helps AI systems understand what the site offers and how to cite it accurately.
 */
export async function GET(): Promise<NextResponse> {
  return new NextResponse(LLM_CONTENT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
