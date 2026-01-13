import React, { forwardRef, type ReactNode } from 'react';
import styles from './GlassCard.module.css';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({ children, className = '', style, ...props }, ref) => {
  return (
    <div ref={ref} className={`${styles.glassCard} ${className}`} style={style} {...props}>
      {children}
    </div>
  );
});

GlassCard.displayName = "GlassCard";
