import React, { type ReactNode } from 'react';
import styles from './AppLayout.module.css';
import { ParticleBackground } from './ParticleBackground';
import { useUIStore } from '../../stores/uiStore';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const modalCount = useUIStore(state => state.modalCount);

  return (
    <div className={styles.container}>
      {/* Animated Particle Background - remains clear */}
      <ParticleBackground particleCount={15} />
      
      {/* Main Content Area - blurred when modal is open */}
      <main 
        className={styles.main}
        style={{
            transition: 'filter 0.2s ease-out',
            filter: modalCount > 0 ? 'blur(6px) brightness(0.8)' : 'none',
            pointerEvents: modalCount > 0 ? 'none' : 'auto',
            willChange: modalCount > 0 ? 'filter' : 'auto',
            transform: 'translateZ(0)', // Force GPU layer
        }}
      >
        {/* <div className={styles.dragRegion} /> - Removed to prevent overlapping header controls */}
        <div className={styles.contentWrapper}>
          {children}
        </div>
      </main>
    </div>
  );
};
