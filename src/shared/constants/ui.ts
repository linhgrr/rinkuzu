// UI Constants - Colors, Animations, Layout
export const COLORS = {
  CATEGORY: {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    purple: 'bg-violet-100 text-violet-700 border-violet-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    pink: 'bg-pink-100 text-pink-700 border-pink-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    teal: 'bg-teal-100 text-teal-700 border-teal-200'
  }
} as const

export const ANIMATIONS = {
  EMOTION_CHANGE_INTERVAL: 8000, // 8 seconds
  CARD_STAGGER_DELAY: 100, // 100ms per card
  LOADING_PULSE_DURATION: 3000,
  HOVER_TRANSITION: 500,
  SPARKLE_DELAY: 100 // per sparkle
} as const

export const LAYOUT = {
  PAGINATION: {
    DEFAULT_LIMIT: 12,
    DEFAULT_PAGE: 1
  },
  CARD: {
    MIN_WIDTH: 200,
    GRID_COLS: {
      MOBILE: 1,
      TABLET: 2,
      DESKTOP: 3
    }
  },
  AVATAR: {
    SIZE: 160, // 40 * 4 (w-40 h-40)
    BORDER_RADIUS: 9999 // rounded-full
  }
} as const

export const EMOTIONS = ['happy', 'wink', 'smile', 'wave', 'dance'] as const

export const EMOTION_LABELS = {
  happy: '😊 Happy',
  wink: '😉 Wink', 
  smile: '😄 Smile',
  wave: '👋 Wave',
  dance: '💃 Dance'
} as const

export const MAGIC_EFFECTS = {
  SAKURA_COUNT: 6,
  GLOWING_ORBS_COUNT: 4,
  SPARKLES_COUNT: 8,
  ORB_POSITIONS: [
    { left: '20%', top: '20%' },
    { left: '40%', top: '40%' },
    { left: '60%', top: '60%' },
    { left: '80%', top: '80%' }
  ]
} as const 