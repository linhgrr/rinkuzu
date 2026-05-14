// Central export for all application constants
export * from './ui';
export * from './routes';

// Type exports for better TypeScript support
export type EmotionType = (typeof import('./ui').EMOTIONS)[number];
export type CategoryColor = keyof typeof import('./ui').COLORS.CATEGORY;
