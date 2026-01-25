import { useState, useEffect, useRef, useCallback } from 'react';
import { easeOutExpo } from '../utils/animations';

interface UseCountUpOptions {
  /** Duration of animation in ms */
  duration?: number;
  /** Easing function */
  easing?: (t: number) => number;
  /** Number of decimal places */
  decimals?: number;
  /** Whether to animate on mount */
  animateOnMount?: boolean;
  /** Prefix (e.g., "$") */
  prefix?: string;
  /** Suffix (e.g., "%") */
  suffix?: string;
  /** Separator for thousands */
  separator?: string;
}

interface UseCountUpReturn {
  /** Current displayed value */
  value: number;
  /** Formatted string value */
  formattedValue: string;
  /** Whether animation is in progress */
  isAnimating: boolean;
  /** Trigger count-up to new value */
  countTo: (newValue: number) => void;
  /** Reset to initial value without animation */
  reset: (value?: number) => void;
}

/**
 * Hook for animated number counting
 * 
 * Usage:
 * ```tsx
 * const { formattedValue, isAnimating } = useCountUp(1234, { duration: 1000 });
 * return <span>{formattedValue}</span>;
 * ```
 */
export const useCountUp = (
  targetValue: number,
  options: UseCountUpOptions = {}
): UseCountUpReturn => {
  const {
    duration = 800,
    easing = easeOutExpo,
    decimals = 0,
    animateOnMount = true,
    prefix = '',
    suffix = '',
    separator = ',',
  } = options;

  const [value, setValue] = useState(animateOnMount ? 0 : targetValue);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Refs for stability and mutable state tracking
  const startTime = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);
  const previousTarget = useRef(targetValue);
  const valueRef = useRef(value);
  
  // Update valueRef on every render so we can access current value in effects without dependencies
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Format number with separators and decimals
  const formatNumber = useCallback(
    (num: number): string => {
      const fixed = num.toFixed(decimals);
      const parts = fixed.split('.');
      
      // Add thousand separators
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      
      const formatted = parts.join('.');
      return `${prefix}${formatted}${suffix}`;
    },
    [decimals, prefix, suffix, separator]
  );

  // Reusable animation driver
  // captures 'duration' and 'easing' from closure (assumed stable or safe to restart if changed)
  const startAnimation = useCallback((from: number, to: number) => {
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    startTime.current = null;
    setIsAnimating(true);
    
    // Define the loop function locally to avoid explicit recursion dependencies
    const animate = (timestamp: number) => {
      if (startTime.current === null) {
        startTime.current = timestamp;
      }

      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const currentValue = from + (to - from) * easedProgress;
      setValue(currentValue);

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        setValue(to);
        setIsAnimating(false);
        startTime.current = null;
        animationFrame.current = null;
      }
    };

    animationFrame.current = requestAnimationFrame(animate);
  }, [duration, easing]);

  // Watch for target changes
  useEffect(() => {
    // Skip if target hasn't changed and we aren't supposed to animate on mount
    if (targetValue === previousTarget.current && !animateOnMount) {
      return;
    }

    // Capture the *current* value as the starting point for the new animation
    const startFrom = valueRef.current;
    
    startAnimation(startFrom, targetValue);
    previousTarget.current = targetValue;

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [targetValue, animateOnMount, startAnimation]);

  // Manual trigger
  const countTo = useCallback(
    (newValue: number) => {
      const startFrom = valueRef.current;
      startAnimation(startFrom, newValue);
      previousTarget.current = newValue;
    },
    [startAnimation]
  );

  // Reset without animation
  const reset = useCallback((resetValue = 0) => {
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
    setValue(resetValue);
    setIsAnimating(false);
    previousTarget.current = resetValue;
  }, []);

  return {
    value,
    formattedValue: formatNumber(value),
    isAnimating,
    countTo,
    reset,
  };
};

/**
 * Simplified hook that just returns the animated value
 */
export const useAnimatedNumber = (
  target: number,
  duration = 800
): number => {
  const { value } = useCountUp(target, { duration });
  return Math.round(value);
};
