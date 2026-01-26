import React, { memo } from 'react';
import styles from './NeonButton.module.css';
import { useSimpleRipple } from '../../hooks/useRipple';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  /** Disable ripple effect */
  noRipple?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = memo(({ 
  children, 
  variant = 'primary', 
  size = 'md',
  glow = true,
  noRipple = false,
  className,
  onClick,
  ...props 
}) => {
  const createRipple = useSimpleRipple(
    variant === 'danger' 
      ? 'rgba(239, 68, 68, 0.4)' 
      : variant === 'ghost'
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(255, 255, 255, 0.4)'
  );

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!noRipple && !props.disabled) {
      createRipple(e);
    }
    onClick?.(e);
  };

  return (
    <button 
      className={`${styles.button} ${styles[variant]} ${styles[size] || ''} ${glow ? styles.glow : ''} ${className || ''}`}
      onClick={handleClick}
      {...props}
    >
      <span className={styles.content}>{children}</span>
      {glow && <div className={styles.glowLayer} />}
    </button>
  );
});

NeonButton.displayName = 'NeonButton';
