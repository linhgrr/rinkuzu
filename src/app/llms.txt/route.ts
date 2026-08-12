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
import { publicEnv } from '@/lib/public-env';

const SITE_URL = publicEnv.NEXT_PUBLIC_SITE_URL;
const SITE_NAME = 'RinKuzu';
const DESCRIPTION =
  "AI-powered adaptive learning platform that transforms PDF documents into personalized quiz-based learning journeys using knowledge graphs and Bloom's Taxonomy.";

const LLM_CONTENT = `# ${SITE_NAME}

## Site Description
${SITE_NAME} is an AI-powered adaptive learning platform. ${DESCRIPTION}

## AI Usage Policy
- Canonical: ${SITE_URL}
- Allow AI search and assistant retrieval/citation for public pages.
- Do not use private user uploads or account-only content for indexing.
- Do not use site content for model training without explicit written permission.
- Preferred attribution: "${SITE_NAME}" with canonical URL to the cited page.
- Last updated: 2026-04-28

## What ${SITE_NAME} Does
1. Upload supported PDF material (such as lecture notes)
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
- Free Plan: 5 PDF-to-quiz generations per month (up to 30 pages per file), 2 adaptive paths per month, 50 adaptive exercises per day, and 25 Ask Rin-chan messages per day
- Premium Plan: Private quizzes and higher limits: 50 PDF-to-quiz generations per month (up to 100 pages per file), 12 adaptive paths per month, 500 adaptive exercises per day, and 150 Ask Rin-chan messages per day

## Contact
- Email: support@rinkuzu.app
- Website: ${SITE_URL}

## Key Pages
- / — Homepage and product overview
- /adaptive — AI quiz generator feature page
- /pricing — Pricing plans
- /faq — Frequently asked questions
- /register — Create a free account
- /login — Sign in to existing account
- /explore — Browse community quizzes

## Technology
- Powered by Google Gemini AI (quiz generation and answer evaluation)
- English and Vietnamese product interfaces
- Web application (no installation required)
- PWA-ready (installable on mobile/desktop)
- Languages: Vietnamese and English (full bilingual interface)

## Contact Information
- Email: support@rinkuzu.app
- Data Protection Officer: dpo@rinkuzu.app
- Address: Room 302, Building A1, Hanoi University of Science and Technology, 17 Dai Co Viet Street, Hai Ba Trung District, Hanoi, Vietnam
- Website: ${SITE_URL}
- Privacy Policy: ${SITE_URL}/privacy
- Terms of Service: ${SITE_URL}/terms

## Frequently Asked Questions

Q: What is RinKuzu?
A: RinKuzu is an AI-powered adaptive learning platform that transforms PDF documents into personalized quiz-based learning journeys. Using knowledge graphs and Bloom's Taxonomy, it helps students, teachers, and training teams master any subject at their own pace. The system uses SAINT-Bloom knowledge tracing and Dueling DQN reinforcement learning to continuously adapt to each learner's progress.

Q: How do I generate a quiz from a PDF?
A: Upload supported PDF material and RinKuzu extracts key concepts, identifies prerequisite relationships, and generates quizzes with explanations.

Q: Is RinKuzu free to use?
A: Yes. Free includes 5 PDF-to-quiz generations per month (up to 30 pages per file), 2 adaptive paths per month, 50 adaptive exercises per day, and 25 Ask Rin-chan messages per day. Premium unlocks private quizzes and raises these limits. See /pricing for details.

Q: Which languages does RinKuzu support?
A: RinKuzu supports Vietnamese and English with a full bilingual interface. AI-generated content adapts to the language of your uploaded PDF.

Q: What is a knowledge graph in learning?
A: A knowledge graph maps relationships between concepts in your material. RinKuzu builds a visual graph showing prerequisite chains to provide context for choosing a next practice step.

Q: What is Bloom's Taxonomy?
A: Bloom's Taxonomy classifies cognitive levels from Remember to Create. RinKuzu uses these levels to vary the kinds of practice questions it generates.

Q: How does adaptive learning work on RinKuzu?
A: RinKuzu tracks your performance using Bayesian Knowledge Tracing (BKT), prioritizing questions on your weakest concepts. A Dueling DQN reinforcement learning agent selects the next best (concept, difficulty) pair. The AI adjusts difficulty dynamically for maximum learning efficiency.

Q: What is the AI tutor Rin-chan?
A: Rin-chan is RinKuzu's built-in AI assistant for explanations, follow-up questions, and guidance through practice topics.

Q: Can teachers use RinKuzu for classroom assessment?
A: Yes. Teachers can turn lecture PDFs into quizzes and share public quizzes with students. Classroom management and class-wide analytics are not currently available.

Q: How is my data and privacy protected?
A: Uploaded PDFs are processed to generate learning content. A quiz is shared publicly only when its owner chooses to publish it publicly. See /privacy for details about data processing and storage.

Q: What file formats are supported?
A: Currently PDF documents are supported. We recommend using text-based PDFs (not scanned images) for the best quiz generation quality. Word, PowerPoint, and plain text support is on the roadmap.

Q: Does RinKuzu work on mobile?
A: Yes. RinKuzu has an installable Progressive Web App manifest and a responsive web experience for desktop, tablet, and mobile browsers.
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
