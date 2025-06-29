// Utility functions for working with constants
import { COLORS, EMOTIONS, type EmotionType, type CategoryColor } from '../constants'

/**
 * Get category color class by color name
 */
export const getCategoryColorClass = (color: string): string => {
  return COLORS.CATEGORY[color?.toLowerCase() as CategoryColor] || COLORS.CATEGORY.purple
}

/**
 * Get random emotion from available emotions
 */
export const getRandomEmotion = (): EmotionType => {
  return EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)]
}

/**
 * Get next emotion in cycle
 */
export const getNextEmotion = (currentEmotion: EmotionType): EmotionType => {
  const currentIndex = EMOTIONS.indexOf(currentEmotion)
  return EMOTIONS[(currentIndex + 1) % EMOTIONS.length]
}

/**
 * Format date using predefined formats
 */
export const formatDisplayDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Create URLSearchParams with proper typing
 */
export const createQuizSearchParams = (
  page: number,
  limit: number,
  status: string,
  search?: string,
  category?: string
): URLSearchParams => {
  const params = new URLSearchParams({
    status,
    page: page.toString(),
    limit: limit.toString()
  })

  if (search?.trim()) {
    params.append('search', search.trim())
  }

  if (category?.trim()) {
    params.append('category', category.trim())
  }

  return params
} 