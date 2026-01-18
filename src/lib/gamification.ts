// src/lib/gamification.ts

/**
 * Calculate user level from XP (Linear: 100 XP = 1 level)
 * Level 1: 0-99 XP
 * Level 2: 100-199 XP
 * etc.
 */
export function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / 100) + 1;
}

/**
 * Calculate XP needed for next level
 */
export function xpForNextLevel(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp);
  const xpForCurrentLevel = (currentLevel - 1) * 100;
  const xpForNext = currentLevel * 100;
  return xpForNext - totalXp;
}

/**
 * Calculate progress percentage to next level (0-100)
 */
export function levelProgress(totalXp: number): number {
  const xpInCurrentLevel = totalXp % 100;
  return xpInCurrentLevel;
}
