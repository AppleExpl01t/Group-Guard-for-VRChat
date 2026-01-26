/**
 * Shared Animation Utilities
 * Central location for animation presets, springs, and timing configurations
 */

import type { Transition, Variants } from 'framer-motion';

// ============================================================================
// SPRING PRESETS
// ============================================================================

/** Quick, snappy interactions (buttons, toggles) */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 1,
};

/** Bouncy, playful feel (modals, cards) */
export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 20,
  mass: 1,
};

/** Gentle, smooth transitions (page changes, large elements) */
export const springGentle: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
  mass: 1.2,
};

/** Very soft, floating feel (ambient elements) */
export const springFloat: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 15,
  mass: 1.5,
};

// ============================================================================
// DURATION PRESETS
// ============================================================================

export const durations = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
  verySlow: 0.6,
} as const;

// ============================================================================
// EASING PRESETS
// ============================================================================

export const easings = {
  /** Standard ease for most transitions */
  default: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
  /** Ease out for enter animations */
  out: [0, 0.55, 0.45, 1] as [number, number, number, number],
  /** Ease in for exit animations */
  in: [0.55, 0, 1, 0.45] as [number, number, number, number],
  /** Bouncy overshoot */
  overshoot: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
} as const;

// ============================================================================
// STAGGER CONFIGS
// ============================================================================

/** Quick stagger for lists */
export const staggerFast = {
  staggerChildren: 0.05,
  delayChildren: 0.1,
};

/** Normal stagger for content */
export const staggerNormal = {
  staggerChildren: 0.1,
  delayChildren: 0.15,
};

/** Slow stagger for dramatic reveals */
export const staggerSlow = {
  staggerChildren: 0.15,
  delayChildren: 0.2,
};

// ============================================================================
// COMMON VARIANT PRESETS
// ============================================================================

/** Fade in/out */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durations.normal } },
  exit: { opacity: 0, transition: { duration: durations.fast } },
};

/** Slide up with fade */
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: springBouncy },
  exit: { opacity: 0, y: -10, transition: { duration: durations.fast } },
};

/** Slide in from left */
export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: springBouncy },
  exit: { opacity: 0, x: 30, transition: { duration: durations.fast } },
};

/** Scale up with fade (for modals, cards) */
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: springBouncy },
  exit: { opacity: 0, scale: 0.95, transition: { duration: durations.fast } },
};

/** Pop in effect */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: springSnappy },
  exit: { opacity: 0, scale: 0.9, transition: { duration: durations.instant } },
};

/** Container with stagger */
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      ...staggerNormal,
    },
  },
};

/** List item variants (for use with container) */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, y: -5, transition: { duration: durations.fast } },
};

// ============================================================================
// SPECIALIZED ANIMATIONS
// ============================================================================

/** Pulse animation for live indicators */
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.15, 1],
    opacity: [1, 0.7, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/** Glow pulse for status indicators */
export const glowPulseVariants: Variants = {
  glow: {
    boxShadow: [
      '0 0 5px var(--color-primary-glow)',
      '0 0 20px var(--color-primary-glow)',
      '0 0 5px var(--color-primary-glow)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/** Shake animation for errors */
export const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  },
};

/** Heartbeat for connection status */
export const heartbeatVariants: Variants = {
  beat: {
    scale: [1, 1.2, 1, 1.1, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
      repeatDelay: 0.5,
    },
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a stagger transition with custom timing
 */
export const createStagger = (staggerMs: number, delayMs = 0) => ({
  staggerChildren: staggerMs / 1000,
  delayChildren: delayMs / 1000,
});

/**
 * Creates a custom spring transition
 */
export const createSpring = (
  stiffness: number,
  damping: number,
  mass = 1
): Transition => ({
  type: 'spring',
  stiffness,
  damping,
  mass,
});

/**
 * Easing function for count-up animations
 */
export const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

/**
 * Easing function for smooth deceleration
 */
export const easeOutQuart = (t: number): number => {
  return 1 - Math.pow(1 - t, 4);
};
