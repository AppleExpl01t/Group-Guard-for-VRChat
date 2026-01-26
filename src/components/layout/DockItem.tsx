import React, { memo } from 'react';
import styles from './NeonDock.module.css';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';


interface DockItemProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode | LucideIcon; // Allow any icon component or LucideIcon
  color?: string;
}

export const DockItem = memo<DockItemProps>(({ label, isActive, onClick, icon, color = 'var(--color-primary)' }) => {
  // Handle both raw ReactNode (legacy) and LucideIcon types if passed as component
  const isElement = React.isValidElement(icon);
  const IconComponent = icon as LucideIcon;

  return (
    <button
      onClick={onClick}
      className={`${styles.dockItem} ${isActive ? styles.dockItemActive : ''}`}
      aria-label={label}
      style={{ '--item-color': color } as React.CSSProperties}
    >
      {/* Glow Effect behind active item */}
      {isActive && (
        <motion.div 
            layoutId="activeGlow"
            className={styles.glowEffect} 
            transition={{ duration: 0.2 }}
        />
      )}

      <div className={`${styles.iconWrapper} ${isActive ? styles.iconWrapperActive : ''}`}>
        {isElement ? icon : <IconComponent size={24} />}
      </div>
      
      <span className={`${styles.label} ${isActive ? styles.labelActive : ''}`}>
        {label}
      </span>
      
      {/* Active Indicator Dot */}
      {isActive && (
        <motion.div 
            layoutId="activeDot"
            className={styles.activeDot} 
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
});

DockItem.displayName = 'DockItem';
