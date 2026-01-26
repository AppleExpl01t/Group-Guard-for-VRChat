import React, { useCallback, useRef, useState } from 'react';
import type { Variants } from 'framer-motion';

// ============================================================================
// SHAKE ANIMATION FOR ERRORS
// ============================================================================

export const shakeAnimation: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, -5, 5, 0],
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  },
  idle: {
    x: 0,
  },
};

/**
 * Hook for shake animation on errors
 */
export const useShake = () => {
  const [isShaking, setIsShaking] = useState(false);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }, []);

  return {
    isShaking,
    triggerShake,
    animationState: isShaking ? 'shake' : 'idle',
  };
};

// ============================================================================
// PULSE ANIMATION FOR DATA UPDATES
// ============================================================================

/**
 * Hook for pulse effect when data changes
 */
export const usePulse = () => {
  const [isPulsing, setIsPulsing] = useState(false);

  const triggerPulse = useCallback(() => {
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 400);
  }, []);

  return {
    isPulsing,
    triggerPulse,
  };
};

// ============================================================================
// STATUS INDICATOR ANIMATIONS
// ============================================================================

export const heartbeatAnimation: Variants = {
  beat: {
    scale: [1, 1.2, 1, 1.1, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
      repeatDelay: 0.5,
    },
  },
};

export const radarAnimation: Variants = {
  ping: {
    scale: [1, 2.5, 3],
    opacity: [0.6, 0.2, 0],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeOut',
    },
  },
};

// ============================================================================
// TAG GLOW EFFECT
// ============================================================================

/**
 * Generate CSS for tag glow based on color
 */
export const getTagGlowStyle = (color: string): React.CSSProperties => ({
  boxShadow: `0 0 8px ${color}40, 0 0 16px ${color}20`,
  border: `1px solid ${color}60`,
});

// ============================================================================
// GRADIENT PROGRESS BAR
// ============================================================================

export const gradientProgressStyle = (progress: number, color1: string, color2: string): React.CSSProperties => ({
  background: `linear-gradient(90deg, ${color1} 0%, ${color2} 100%)`,
  width: `${progress}%`,
  backgroundSize: '200% 100%',
  animation: 'gradientFlow 2s linear infinite',
});

// Add this CSS to your global styles or a component
export const gradientFlowKeyframes = `
@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
`;

// ============================================================================
// PARTICLE BURST EFFECT
// ============================================================================

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  angle: number;
  velocity: number;
  color: string;
}

/**
 * Hook for particle burst effect on click
 */
export const useParticleBurst = (particleCount = 8) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const createBurst = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const particles: Particle[] = Array.from({ length: particleCount }).map((_, i) => ({
      id: Date.now() + i,
      x,
      y,
      size: Math.random() * 6 + 2,
      angle: (i / particleCount) * Math.PI * 2 + Math.random() * 0.5,
      velocity: Math.random() * 100 + 50,
      color: Math.random() > 0.5 ? 'var(--color-primary)' : 'var(--color-accent)',
    }));
    
    particles.forEach((p) => {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        left: ${p.x}px;
        top: ${p.y}px;
        width: ${p.size}px;
        height: ${p.size}px;
        border-radius: 50%;
        background: ${p.color};
        box-shadow: 0 0 ${p.size * 2}px ${p.color};
        pointer-events: none;
        z-index: 9999;
      `;
      
      containerRef.current?.appendChild(particle);
      
      // Animate outward
      const endX = p.x + Math.cos(p.angle) * p.velocity;
      const endY = p.y + Math.sin(p.angle) * p.velocity;
      
      particle.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${endX - p.x}px, ${endY - p.y}px) scale(0)`, opacity: 0 }
      ], {
        duration: 600,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      }).onfinish = () => particle.remove();
    });
  }, [particleCount]);
  
  return { containerRef, createBurst };
};
