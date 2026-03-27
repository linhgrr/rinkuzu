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
- Powered by Google Gemini AI (quiz generation and answer evaluation)
- Built by Hanoi University of Science and Technology (HUST)
- Web application (no installation required)
- PWA-ready (installable on mobile/desktop)
- Languages: Vietnamese and English (full bilingual interface)

## Contact Information
- Email: support@rinkuzu.com
- Data Protection Officer: dpo@rinkuzu.com
- Address: Room 302, Building A1, Hanoi University of Science and Technology, 17 Dai Co Viet Street, Hai Ba Trung District, Hanoi, Vietnam
- Website: ${SITE_URL}
- Privacy Policy: ${SITE_URL}/privacy
- Terms of Service: ${SITE_URL}/terms

## Frequently Asked Questions

Q: What is RinKuzu?
A: RinKuzu is an AI-powered adaptive learning platform that transforms PDF documents into personalized quiz-based learning journeys. Using knowledge graphs and Bloom's Taxonomy, it helps students, teachers, and training teams master any subject at their own pace. The system uses SAINT-Bloom knowledge tracing and Dueling DQN reinforcement learning to continuously adapt to each learner's progress.

Q: How do I generate a quiz from a PDF?
A: Simply upload any PDF document — lecture notes, textbooks, or internal docs — and RinKuzu's AI will automatically extract key concepts, identify prerequisite relationships, and generate high-quality quizzes with explanations. No manual question writing required. The process takes under a minute for most documents.

Q: Is RinKuzu free to use?
A: Yes. RinKuzu's free plan includes unlimited PDF-to-quiz generation, adaptive practice, mastery tracking, and community quiz browsing. A Premium plan offers advanced features and priority support. See /pricing for details.

Q: Which languages does RinKuzu support?
A: RinKuzu supports Vietnamese and English with a full bilingual interface. AI-generated content adapts to the language of your uploaded PDF.

Q: What is a knowledge graph in learning?
A: A knowledge graph maps the relationships between concepts in your material. RinKuzu builds a visual graph showing prerequisite chains so you can see the learning path from fundamentals to advanced topics — ensuring you never practice a concept before mastering its prerequisites.

Q: What is Bloom's Taxonomy?
A: Bloom's Taxonomy classifies cognitive levels from Remember to Create. RinKuzu generates questions at each level — from basic recall to higher-order reasoning — ensuring deep mastery. The six levels are: Remember, Understand, Apply, Analyze, Evaluate, and Create.

Q: How does adaptive learning work on RinKuzu?
A: RinKuzu tracks your performance using Bayesian Knowledge Tracing (BKT), prioritizing questions on your weakest concepts. A Dueling DQN reinforcement learning agent selects the next best (concept, difficulty) pair. The AI adjusts difficulty dynamically for maximum learning efficiency.

Q: What is the AI tutor Rin-chan?
A: Rin-chan is RinKuzu's built-in AI tutor. It explains any concept from your PDF in plain language, answers follow-up questions, and guides you through difficult topics — available 24/7 within the app.

Q: Can teachers use RinKuzu for classroom assessment?
A: Absolutely. Teachers can upload lecture PDFs to generate student quizzes, track class-wide performance, and identify concepts that need re-teaching. Contact support@rinkuzu.com for educator pricing and bulk access.

Q: How is my data and privacy protected?
A: Uploaded PDFs are processed securely and kept private by default. We never use your content to train AI models. RinKuzu is GDPR and Vietnamese PDPA compliant. See /privacy for full details.

Q: What file formats are supported?
A: Currently PDF documents are supported. We recommend using text-based PDFs (not scanned images) for the best quiz generation quality. Word, PowerPoint, and plain text support is on the roadmap.

Q: Does RinKuzu work on mobile?
A: Yes. RinKuzu is a Progressive Web App (PWA) that works on desktop, tablet, and mobile browsers. Install it for an app-like experience with offline access to your progress.
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
