import React, { memo } from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** Width of the skeleton (CSS value) */
  width?: string | number;
  /** Height of the skeleton (CSS value) */
  height?: string | number;
  /** Variant type */
  variant?: 'default' | 'circle' | 'pill' | 'text';
  /** Whether to add pulse animation */
  pulse?: boolean;
  /** Use primary color tint */
  primary?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Number of text lines to render (for variant="text") */
  lines?: number;
}

/**
 * Skeleton loading placeholder with shimmer animation
 * 
 * Usage:
 * ```tsx
 * // Simple rectangle
 * <Skeleton width={200} height={40} />
 * 
 * // Avatar circle
 * <Skeleton variant="circle" width={48} height={48} />
 * 
 * // Multiple text lines
 * <Skeleton variant="text" lines={3} />
 * ```
 */
export const Skeleton: React.FC<SkeletonProps> = memo(({
  width,
  height,
  variant = 'default',
  pulse = false,
  primary = false,
  className = '',
  style = {},
  lines = 1,
}) => {
  const baseClasses = [
    styles.skeleton,
    variant === 'circle' && styles.skeletonCircle,
    variant === 'pill' && styles.skeletonPill,
    variant === 'text' && styles.skeletonText,
    pulse && styles.skeletonPulse,
    primary && styles.skeletonPrimary,
    className,
  ].filter(Boolean).join(' ');

  const baseStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  // Render multiple lines for text variant
  if (variant === 'text' && lines > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={baseClasses}
            style={{
              ...baseStyle,
              // Make last line shorter for natural text look
              width: i === lines - 1 ? '70%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return <div className={baseClasses} style={baseStyle} />;
});

Skeleton.displayName = 'Skeleton';

/**
 * Pre-composed skeleton for stat tiles
 */
export const StatTileSkeleton: React.FC<{ className?: string }> = memo(({ className }) => (
  <div 
    className={className}
    style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px',
      padding: '1rem',
      background: 'rgba(0,0,0,0.2)',
      borderRadius: 'var(--border-radius)',
    }}
  >
    <Skeleton variant="text" width="60%" height={12} />
    <Skeleton width="80%" height={32} primary />
  </div>
));

StatTileSkeleton.displayName = 'StatTileSkeleton';

/**
 * Pre-composed skeleton for list items
 */
export const ListItemSkeleton: React.FC<{ className?: string }> = memo(({ className }) => (
  <div 
    className={className}
    style={{ 
      display: 'flex', 
      alignItems: 'center',
      gap: '12px',
      padding: '0.75rem',
    }}
  >
    <Skeleton variant="circle" width={40} height={40} />
    <div style={{ flex: 1 }}>
      <Skeleton variant="text" width="50%" height={16} style={{ marginBottom: '6px' }} />
      <Skeleton variant="text" width="30%" height={12} />
    </div>
  </div>
));

ListItemSkeleton.displayName = 'ListItemSkeleton';

/**
 * Pre-composed skeleton for cards
 */
export const CardSkeleton: React.FC<{ className?: string }> = memo(({ className }) => (
  <div 
    className={className}
    style={{ 
      padding: '1.5rem',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 'var(--border-radius)',
      border: '1px solid rgba(255,255,255,0.05)',
    }}
  >
    <Skeleton width="40%" height={20} style={{ marginBottom: '16px' }} />
    <Skeleton variant="text" lines={3} />
  </div>
));

CardSkeleton.displayName = 'CardSkeleton';
