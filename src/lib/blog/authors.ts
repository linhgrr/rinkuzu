import type { Locale } from '@/i18n/config';

/** Profile behind `/blog/authors/<slug>`; posts reference it by `author` slug. */
export type BlogAuthor = {
  name: string;
  slug: string;
  /** Avatar text in the article byline. */
  initials: string;
  /** Line under the name in the article byline. */
  tagline: string;
  role: string;
  bio: string;
  shortBio: string;
  imageUrl: string;
  links: { label: string; url: string }[];
};

const AUTHORS: Record<string, BlogAuthor> = {
  'rinkuzu-team': {
    name: 'RinKuzu Team',
    slug: 'rinkuzu-team',
    initials: 'RK',
    tagline: 'AI Learning Platform',
    role: 'Research & Engineering',
    bio: `The RinKuzu Team is a group of researchers and engineers at Hanoi University of Science and Technology working at the intersection of personalized learning systems, knowledge graph construction, and educational AI. The team develops the ALSS-LEPC v2 (Adaptive Learning System with LLM-Enhanced RL for Personalized Curriculum) — an end-to-end system that transforms PDF lecture documents into personalized, knowledge-graph-driven learning paths.

The team's research combines Bayesian Knowledge Tracing, deep knowledge tracing with SAINT-Bloom models, Reinforcement Learning-based curriculum sequencing using Dueling Double DQN, and large language model-powered exercise generation to create a fully automated pipeline from document to mastery.`,
    shortBio:
      'Researchers and engineers building AI-powered personalized learning systems from Hanoi University of Science and Technology.',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80',
    links: [],
  },
};

const VI_OVERRIDES: Record<string, Partial<BlogAuthor>> = {
  'rinkuzu-team': {
    role: 'Nghiên cứu & Kỹ thuật',
    bio: `Nhóm RinKuzu gồm các nhà nghiên cứu và kỹ sư tại Đại học Bách khoa Hà Nội, làm việc trong các lĩnh vực hệ thống học cá nhân hóa, xây dựng đồ thị kiến thức và AI giáo dục. Nhóm phát triển quy trình biến tài liệu PDF thành lộ trình luyện tập cá nhân hóa dựa trên quan hệ kiến thức.

Hệ thống kết hợp theo dõi mức độ nắm vững, sắp xếp nội dung học và tạo bài tập bằng mô hình ngôn ngữ để hỗ trợ người học đi từ tài liệu nguồn đến bước luyện tập tiếp theo.`,
    shortBio:
      'Nhóm nghiên cứu và kỹ sư phát triển hệ thống học cá nhân hóa bằng AI tại Đại học Bách khoa Hà Nội.',
  },
};

/** The author profile, localized for `/vi` where a translation exists. */
export const getBlogAuthor = (slug: string, locale: Locale = 'en'): BlogAuthor | undefined => {
  const author = AUTHORS[slug];
  if (!author) return undefined;
  return locale === 'vi' ? { ...author, ...VI_OVERRIDES[slug] } : author;
};
