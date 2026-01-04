import React, { useState, memo } from 'react';

interface Particle {
  id: number;
  left: number;
  size: number;
  isPrimary: boolean;
  duration: number;
  delay: number;
}

interface ParticleBackgroundProps {
  particleCount?: number;
  className?: string;
}

// Generate particles once
const generateParticles = (count: number): Particle[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: Math.random() * 3 + 1,
    isPrimary: Math.random() > 0.5,
    duration: Math.random() * 8 + 8, // Slower, smoother
    delay: Math.random() * 8
  }));
};

// Memoized particle component for performance
const ParticleElement = memo<{ particle: Particle }>(({ particle }) => (
  <div
    style={{
      position: 'absolute',
      left: `${particle.left}%`,
      bottom: '-5%',
      width: `${particle.size}px`,
      height: `${particle.size}px`,
      borderRadius: '50%',
      background: particle.isPrimary ? 'var(--color-primary)' : 'cyan',
      boxShadow: `0 0 ${particle.size * 3}px ${particle.isPrimary ? 'var(--color-primary)' : 'cyan'}`,
      opacity: 0,
      willChange: 'transform, opacity',
      animation: `particleFloat ${particle.duration}s linear ${particle.delay}s infinite`,
    }}
  />
));

ParticleElement.displayName = 'ParticleElement';

/**
 * Optimized animated particle background component
 * Uses pure CSS animations for GPU-accelerated performance
 */
export const ParticleBackground: React.FC<ParticleBackgroundProps> = memo(({ 
  particleCount = 15, // Reduced count for better performance
  className 
}) => {
  // Generate stable particles once
  const [particles] = useState<Particle[]>(() => generateParticles(particleCount));

  return (
    <div className={className} style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0,
      contain: 'strict', // CSS containment for better performance
    }}>
      {/* CSS Animation Keyframes */}
      <style>{`
        @keyframes particleFloat {
          0% {
            transform: translateY(0) translateZ(0);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-100vh) translateZ(0);
            opacity: 0;
          }
        }
        @keyframes gradientPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* Static Background Gradients - no blur for performance */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at 30% 20%, hsla(var(--primary-hue), 80%, 30%, 0.15) 0%, transparent 50%)',
        willChange: 'opacity',
        animation: 'gradientPulse 10s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at 70% 80%, hsla(var(--accent-hue), 80%, 40%, 0.1) 0%, transparent 50%)',
        willChange: 'opacity',
        animation: 'gradientPulse 12s ease-in-out infinite 2s',
      }} />

      {/* Floating Particles - using CSS animations */}
      {particles.map((particle) => (
        <ParticleElement key={particle.id} particle={particle} />
      ))}
    </div>
  );
});

ParticleBackground.displayName = 'ParticleBackground';
