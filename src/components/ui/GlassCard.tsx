import React, { forwardRef, useCallback, type ReactNode } from 'react';
import styles from './GlassCard.module.css';
import { useMouseGlow } from '../../hooks/useMouseGlow';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Disable the cursor-tracking glow effect */
  disableGlow?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className = '', style, disableGlow = false, onMouseMove, onMouseLeave, ...props }, forwardedRef) => {
    const glow = useMouseGlow();

    // Merge callback refs - our glow ref and forwarded ref
    const mergeRefs = useCallback((node: HTMLDivElement | null) => {
      // Set up our glow ref
      if (!disableGlow) {
        glow.setRef(node);
      }
      
      // Forward to external ref
      if (forwardedRef) {
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else {
          forwardedRef.current = node;
        }
      }
    }, [disableGlow, forwardedRef, glow.setRef]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!disableGlow) glow.onMouseMove(e);
      onMouseMove?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!disableGlow) glow.onMouseLeave();
      onMouseLeave?.(e);
    };

    return (
      // eslint-disable-next-line react-compiler/react-compiler
      <div
        ref={mergeRefs}
        className={`${styles.glassCard} ${className}`}
        style={{ ...glow.style, ...style }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
