import React, { useState, memo, useEffect, useRef, useCallback, useMemo } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  isPrimary: boolean;
  duration: number;
  delay: number;
  layer: 'back' | 'mid' | 'front'; // Depth layer
  baseX: number; // Original position for mouse reactivity
  baseY: number;
  colorShiftDuration: number; // Pre-computed for performance (avoid Math.random in render)
}

interface LightOrb {
  id: number;
  x: number;
  y: number;
  size: number;
  isPrimary: boolean;
  duration: number;
}

interface ParticleBackgroundProps {
  particleCount?: number;
  className?: string;
  /** Enable mouse-reactive particle drift */
  mouseReactive?: boolean;
  /** Show constellation lines between nearby particles */
  showConstellation?: boolean;
  /** Show ambient light orbs */
  showOrbs?: boolean;
  /** Enable color shifting between primary and accent */
  colorShift?: boolean;
}

// Generate particles with depth layers
const generateParticles = (count: number): Particle[] => {
  return Array.from({ length: count }).map((_, i) => {
    const layer = i < count * 0.3 ? 'back' : i < count * 0.7 ? 'mid' : 'front';
    const layerConfig = {
      back: { sizeRange: [3, 5], speedMult: 0.5, opacity: 0.3 },
      mid: { sizeRange: [2, 3], speedMult: 1, opacity: 0.5 },
      front: { sizeRange: [1, 2], speedMult: 1.5, opacity: 0.8 },
    };
    const config = layerConfig[layer];
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    
    return {
      id: i,
      x,
      y,
      baseX: x,
      baseY: y,
      size: Math.random() * (config.sizeRange[1] - config.sizeRange[0]) + config.sizeRange[0],
      isPrimary: Math.random() > 0.5,
      duration: (Math.random() * 8 + 8) / config.speedMult,
      delay: Math.random() * 8,
      layer,
      colorShiftDuration: Math.random() * 5 + 5, // Pre-computed for render performance
    };
  });
};

// Generate ambient light orbs
const generateOrbs = (count: number): LightOrb[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 300 + 200,
    isPrimary: Math.random() > 0.5,
    duration: Math.random() * 20 + 15,
  }));
};

// Memoized particle component for performance
const ParticleElement = memo<{ 
  particle: Particle; 
  mouseOffset: { x: number; y: number };
  colorShift: boolean;
}>(({ particle, mouseOffset, colorShift }) => {
  const layerMultiplier = particle.layer === 'back' ? 0.02 : particle.layer === 'mid' ? 0.05 : 0.1;
  const offsetX = mouseOffset.x * layerMultiplier;
  const offsetY = mouseOffset.y * layerMultiplier;
  
  return (
    <div
      data-particle-id={particle.id}
      style={{
        position: 'absolute',
        left: `calc(${particle.baseX}% + ${offsetX}px)`,
        top: `${particle.baseY}%`,
        width: `${particle.size}px`,
        height: `${particle.size}px`,
        borderRadius: '50%',
        background: particle.isPrimary ? 'var(--color-primary)' : 'var(--color-accent)',
        boxShadow: `0 0 ${particle.size * 3}px ${particle.isPrimary ? 'var(--color-primary)' : 'var(--color-accent)'}`,
        opacity: 0,
        willChange: 'transform, opacity',
        animation: `particleFloat ${particle.duration}s linear ${particle.delay}s infinite${colorShift ? `, colorShift ${particle.colorShiftDuration}s ease-in-out infinite` : ''}`,
        transform: `translateX(${offsetX}px) translateY(${offsetY}px)`,
        transition: 'transform 0.3s ease-out',
      }}
    />
  );
});

ParticleElement.displayName = 'ParticleElement';

// Ambient light orb component
const LightOrbElement = memo<{ orb: LightOrb }>(({ orb }) => (
  <div
    style={{
      position: 'absolute',
      left: `${orb.x}%`,
      top: `${orb.y}%`,
      width: `${orb.size}px`,
      height: `${orb.size}px`,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${orb.isPrimary ? 'hsla(var(--primary-hue), 80%, 50%, 0.08)' : 'hsla(var(--accent-hue), 80%, 50%, 0.06)'} 0%, transparent 70%)`,
      animation: `orbFloat ${orb.duration}s ease-in-out infinite, orbPulse ${orb.duration / 2}s ease-in-out infinite`,
      filter: 'blur(40px)',
      pointerEvents: 'none',
    }}
  />
));

LightOrbElement.displayName = 'LightOrbElement';

/**
 * Enhanced animated particle background component
 * Features: depth layers, mouse reactivity, constellation lines, ambient orbs
 */
export const ParticleBackground: React.FC<ParticleBackgroundProps> = memo(({ 
  particleCount = 12, // Reduced from 25 for healthcare performance
  className,
  mouseReactive = false, // Disabled by default - reduces CPU usage and visual distraction
  showConstellation = false, // Disabled by default - expensive SVG calculations
  showOrbs = true,
  colorShift = false, // Disabled by default - reduces animation complexity
}) => {
  // Generate stable particles and orbs once
  const [particles] = useState<Particle[]>(() => generateParticles(particleCount));
  const [orbs] = useState<LightOrb[]>(() => generateOrbs(3));
  
  // Mouse position for reactivity
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  // Throttled mouse move handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!mouseReactive || !containerRef.current) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setMouseOffset({
        x: (mouseX - centerX) * 0.1,
        y: (mouseY - centerY) * 0.1,
      });
    });
  }, [mouseReactive]);

  useEffect(() => {
    if (!mouseReactive) return;
    
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, mouseReactive]);

  // Generate constellation lines between nearby particles (computed once)
  const constellationLines = useMemo(() => {
    if (!showConstellation) return [];
    
    const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
    const maxDistance = 15; // Percentage distance threshold
    
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        const distance = Math.sqrt(
          Math.pow(p1.baseX - p2.baseX, 2) + Math.pow(p1.baseY - p2.baseY, 2)
        );
        
        if (distance < maxDistance && p1.layer === p2.layer) {
          lines.push({
            x1: p1.baseX,
            y1: p1.baseY,
            x2: p2.baseX,
            y2: p2.baseY,
            opacity: (1 - distance / maxDistance) * 0.15,
          });
        }
      }
    }
    
    return lines;
  }, [particles, showConstellation]);

  return (
    <div 
      ref={containerRef}
      className={className} 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        contain: 'strict',
      }}
    >
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
        @keyframes colorShift {
          0%, 100% { 
            filter: hue-rotate(0deg); 
          }
          50% { 
            filter: hue-rotate(30deg); 
          }
        }
        @keyframes orbFloat {
          0%, 100% { 
            transform: translate(0, 0); 
          }
          25% { 
            transform: translate(5%, 3%); 
          }
          50% { 
            transform: translate(-3%, 5%); 
          }
          75% { 
            transform: translate(-5%, -3%); 
          }
        }
        @keyframes orbPulse {
          0%, 100% { 
            opacity: 0.8; 
          }
          50% { 
            opacity: 0.5; 
          }
        }
        @keyframes constellationPulse {
          0%, 100% { 
            opacity: 0.1; 
          }
          50% { 
            opacity: 0.2; 
          }
        }
      `}</style>

      {/* Static Background Gradients */}
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

      {/* Ambient Light Orbs */}
      {showOrbs && orbs.map((orb) => (
        <LightOrbElement key={orb.id} orb={orb} />
      ))}

      {/* Constellation Lines */}
      {showConstellation && constellationLines.length > 0 && (
        <svg 
          style={{ 
            position: 'absolute', 
            inset: 0, 
            width: '100%', 
            height: '100%',
            animation: 'constellationPulse 4s ease-in-out infinite',
          }}
        >
          {constellationLines.map((line, i) => (
            <line
              key={i}
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke="var(--color-primary)"
              strokeWidth="0.5"
              opacity={line.opacity}
            />
          ))}
        </svg>
      )}

      {/* Floating Particles - using CSS animations */}
      {particles.map((particle) => (
        <ParticleElement 
          key={particle.id} 
          particle={particle} 
          mouseOffset={mouseOffset}
          colorShift={colorShift}
        />
      ))}
    </div>
  );
});

ParticleBackground.displayName = 'ParticleBackground';
