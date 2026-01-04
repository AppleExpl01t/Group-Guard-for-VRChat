import React from 'react';
import styles from './NeonButton.module.css';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  glow = true, 
  className,
  ...props 
}) => {
  return (
    <button 
      className={`${styles.button} ${styles[variant]} ${styles[size] || ''} ${glow ? styles.glow : ''} ${className || ''}`}
      {...props}
    >
      <span className={styles.content}>{children}</span>
      {glow && <div className={styles.glowLayer} />}
    </button>
  );
};
