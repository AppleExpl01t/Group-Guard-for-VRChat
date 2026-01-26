import React, { useEffect, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './StatTile.module.css';
import { useMouseGlow } from '../../../hooks/useMouseGlow';
import { useAnimatedNumber } from '../../../hooks/useCountUp';
import { Skeleton } from '../../../components/ui/Skeleton';

interface StatTileProps {
  label: string;
  value: string | number;
  loading?: boolean;
  color?: string; // CSS color string or var
  onClick?: () => void;
  headerRight?: React.ReactNode;
  headerLeftExtra?: React.ReactNode;
}

const StatTileComponent: React.FC<StatTileProps> = ({
  label,
  value,
  loading = false,
  color = 'var(--color-text-dim)',
  onClick,
  headerRight,
  headerLeftExtra
}) => {
  const glow = useMouseGlow();
  const previousValue = useRef<number | null>(null);
  const [showPulse, setShowPulse] = useState(false);

  // Animate numeric values
  const numericValue = typeof value === 'number' ? value : null;
  const animatedValue = useAnimatedNumber(numericValue ?? 0, 800);

  // Detect value changes for pulse effect
  useEffect(() => {
    if (numericValue !== null && previousValue.current !== null && numericValue !== previousValue.current) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 500);
      return () => clearTimeout(timer);
    }
    previousValue.current = numericValue;
  }, [numericValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const displayValue = loading 
    ? null 
    : numericValue !== null 
      ? animatedValue 
      : value;

  return (
    <motion.div
      ref={glow.setRef}
      role="button"
      tabIndex={0}
      className={styles.tile}
      style={glow.style}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseMove={glow.onMouseMove}
      onMouseLeave={glow.onMouseLeave}
      whileTap={{ scale: 0.98 }}
      animate={showPulse ? { 
        boxShadow: [
          '0 0 0 0 transparent',
          `0 0 20px 5px ${color}40`,
          '0 0 0 0 transparent'
        ]
      } : {}}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.header}>
        <div className={styles.labelContainer}>
          <small className={styles.label} style={{ color }}>{label}</small>
          {headerLeftExtra}
        </div>
        {headerRight}
      </div>
      
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Skeleton width={60} height={28} primary />
          </motion.div>
        ) : (
          <motion.div 
            key="value"
            className={styles.value}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {displayValue}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Memoized for performance - prevents re-render when parent updates
export const StatTile = memo(StatTileComponent, (prev, next) => {
  // Check primitive props
  if (prev.label !== next.label) return false;
  if (prev.value !== next.value) return false;
  if (prev.loading !== next.loading) return false;
  if (prev.color !== next.color) return false;
  if (prev.onClick !== next.onClick) return false;
  // ReactNode props may change reference, but we check identity
  if (prev.headerRight !== next.headerRight) return false;
  if (prev.headerLeftExtra !== next.headerLeftExtra) return false;
  return true;
});
