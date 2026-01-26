import React, { useState, useCallback, useRef, useEffect } from 'react';

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface UseRippleOptions {
  /** Duration of ripple animation in ms */
  duration?: number;
  /** Color of the ripple (CSS color value) */
  color?: string;
  /** Whether ripples are disabled */
  disabled?: boolean;
}

interface UseRippleReturn {
  /** Array of active ripples */
  ripples: Ripple[];
  /** Handler to create ripple on click */
  onRipple: (event: React.MouseEvent<HTMLElement>) => void;
  /** CSS styles for the ripple container */
  containerStyle: React.CSSProperties;
  /** Render function for ripple elements */
  RippleElements: React.FC;
}

/**
 * Hook for creating material-design style ripple effects on click
 * 
 * Usage:
 * ```tsx
 * const { onRipple, RippleElements, containerStyle } = useRipple();
 * 
 * <button onClick={onRipple} style={containerStyle}>
 *   Click Me
 *   <RippleElements />
 * </button>
 * ```
 */
export const useRipple = (options: UseRippleOptions = {}): UseRippleReturn => {
  const {
    duration = 600,
    color = 'rgba(255, 255, 255, 0.4)',
    disabled = false,
  } = options;

  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  // Clean up ripples after animation
  useEffect(() => {
    if (ripples.length === 0) return;

    const timer = setTimeout(() => {
      setRipples((prev) => prev.slice(1));
    }, duration);

    return () => clearTimeout(timer);
  }, [ripples, duration]);

  const onRipple = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;

      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();

      // Calculate ripple position relative to element
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Calculate ripple size (should cover entire element)
      const size = Math.max(rect.width, rect.height) * 2;

      const newRipple: Ripple = {
        id: nextId.current++,
        x,
        y,
        size,
      };

      setRipples((prev) => [...prev, newRipple]);
    },
    [disabled]
  );

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
  };

  // Render function for ripple elements
  const RippleElements: React.FC = () => {
    if (disabled || ripples.length === 0) return null;

    return (
      <>
        <style>{`
          @keyframes ripple-expand {
            0% {
              transform: translate(-50%, -50%) scale(0);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0;
            }
          }
        `}</style>
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            style={{
              position: 'absolute',
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              borderRadius: '50%',
              background: color,
              pointerEvents: 'none',
              animation: `ripple-expand ${duration}ms ease-out forwards`,
              zIndex: 0,
            }}
          />
        ))}
      </>
    );
  };

  return {
    ripples,
    onRipple,
    containerStyle,
    RippleElements,
  };
};

/**
 * Simplified ripple hook that returns just the handler and renders ripples internally
 * Use when you want minimal setup
 */
export const useSimpleRipple = (color = 'rgba(255, 255, 255, 0.4)') => {


  const createRipple = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 2;

      // Create ripple element
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        pointer-events: none;
        transform: translate(-50%, -50%) scale(0);
        animation: simple-ripple 600ms ease-out forwards;
        z-index: 0;
      `;

      // Add keyframes if not already present
      if (!document.getElementById('simple-ripple-keyframes')) {
        const style = document.createElement('style');
        style.id = 'simple-ripple-keyframes';
        style.textContent = `
          @keyframes simple-ripple {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      element.appendChild(ripple);

      // Remove after animation
      setTimeout(() => {
        ripple.remove();
      }, 600);
    },
    [color]
  );

  return createRipple;
};
