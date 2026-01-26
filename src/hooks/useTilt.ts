import React, { useState, useCallback, useRef, type CSSProperties } from 'react';

interface UseTiltOptions {
  /** Maximum tilt angle in degrees */
  maxTilt?: number;
  /** Perspective value */
  perspective?: number;
  /** Scale on hover */
  scale?: number;
  /** Transition speed in ms */
  speed?: number;
  /** Whether effect is disabled */
  disabled?: boolean;
}

interface UseTiltReturn {
  /** Callback ref to attach to the element */
  setRef: (node: HTMLElement | null) => void;
  /** Initial style object to apply to the element */
  style: CSSProperties;
  /** onMouseMove handler */
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  /** onMouseEnter handler */
  onMouseEnter: () => void;
  /** onMouseLeave handler */
  onMouseLeave: () => void;
  /** Whether currently hovering */
  isHovered: boolean;
}

/**
 * Hook for 3D parallax tilt effect on hover
 * PERF FIX: Uses direct DOM manipulation to avoid re-renders during mouse movement
 * 
 * Usage:
 * ```tsx
 * const tilt = useTilt({ maxTilt: 15 });
 * 
 * <div 
 *   ref={tilt.setRef}
 *   style={tilt.style}
 *   onMouseMove={tilt.onMouseMove}
 *   onMouseEnter={tilt.onMouseEnter}
 *   onMouseLeave={tilt.onMouseLeave}
 * >
 *   Content
 * </div>
 * ```
 */
export const useTilt = (options: UseTiltOptions = {}): UseTiltReturn => {
  const {
    maxTilt = 10,
    perspective = 1000,
    scale = 1.02,
    speed = 400,
    disabled = false,
  } = options;

  const [isHovered, setIsHovered] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  // Callback ref - safe to use during render
  const setRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  // Initial style with default transform
  const style: CSSProperties = {
    transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`,
    transition: `transform ${speed}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
  };

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const node = nodeRef.current;
        if (!node) return;
        
        const rect = node.getBoundingClientRect();
        
        // Calculate mouse position relative to element center (0 to 1)
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        
        // Convert to tilt angles (-maxTilt to +maxTilt)
        const tiltY = (x - 0.5) * maxTilt * 2;
        const tiltX = (0.5 - y) * maxTilt * 2;
        
        // Direct DOM manipulation - no React re-render
        node.style.transform = `perspective(${perspective}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${scale})`;
      });
    },
    [maxTilt, perspective, scale, disabled]
  );

  const onMouseEnter = useCallback(() => {
    if (!disabled) {
      setIsHovered(true);
    }
  }, [disabled]);

  const onMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    // Reset transform directly
    const node = nodeRef.current;
    if (node) {
      node.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
    }
  }, [perspective]);

  return {
    setRef,
    style,
    onMouseMove,
    onMouseEnter,
    onMouseLeave,
    isHovered,
  };
};

/**
 * Simpler parallax hook for subtle depth effect
 * PERF FIX: Uses direct DOM manipulation via CSS custom properties
 */
export const useParallax = (intensity = 10) => {
  const nodeRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const setRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  // Initial styles with CSS custom properties
  const style: CSSProperties = {
    '--parallax-x': '0px',
    '--parallax-y': '0px',
  } as CSSProperties;

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const node = nodeRef.current;
        if (!node) return;

        const rect = node.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * intensity;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * intensity;

        // Direct DOM manipulation
        node.style.setProperty('--parallax-x', `${x}px`);
        node.style.setProperty('--parallax-y', `${y}px`);
      });
    },
    [intensity]
  );

  const onMouseLeave = useCallback(() => {
    const node = nodeRef.current;
    if (node) {
      node.style.setProperty('--parallax-x', '0px');
      node.style.setProperty('--parallax-y', '0px');
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  return { setRef, style, onMouseMove, onMouseLeave };
};
