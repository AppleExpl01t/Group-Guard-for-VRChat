import React, { useRef, useEffect, useState, memo } from 'react';

interface ParticleDissolveImageProps {
  /** Current image URL */
  src: string | null;
  /** Alt text */
  alt?: string;
  /** CSS class for the container */
  className?: string;
  /** Inline styles for the container */
  style?: React.CSSProperties;
  /** Number of particles (default: 80) */
  particleCount?: number;
  /** Duration of dissolution in ms (default: 1200) */
  duration?: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
}

// Custom hook to track previous value
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

/**
 * Image component that dissolves into particles when the source changes
 */
export const ParticleDissolveImage: React.FC<ParticleDissolveImageProps> = memo(({
  src,
  alt = '',
  className = '',
  style = {},
  particleCount = 80,
  duration = 1200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  
  // Track previous src for particle effect
  const previousSrc = usePrevious(src);
  
  // Animation state
  const [isDissolving, setIsDissolving] = useState(false);
  const dissolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger dissolution when src changes (and we had a previous image)
  useEffect(() => {
    if (previousSrc && previousSrc !== src) {
      setIsDissolving(true);
      
      // Clear any existing timeout
      if (dissolveTimeoutRef.current) {
        clearTimeout(dissolveTimeoutRef.current);
      }
      
      // End dissolution after animation completes
      dissolveTimeoutRef.current = setTimeout(() => {
        setIsDissolving(false);
      }, duration);
    }
    
    return () => {
      if (dissolveTimeoutRef.current) {
        clearTimeout(dissolveTimeoutRef.current);
      }
    };
  }, [src, previousSrc, duration]);

  // Run particle animation when dissolving
  useEffect(() => {
    if (!isDissolving || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Generate random particles across the image area
    const colors = [
      'rgba(139, 92, 246, 0.9)',  // Purple
      'rgba(59, 130, 246, 0.9)',  // Blue
      'rgba(236, 72, 153, 0.9)',  // Pink
      'rgba(255, 255, 255, 0.8)', // White
      'rgba(34, 211, 238, 0.9)',  // Cyan
    ];

    particlesRef.current = Array.from({ length: particleCount }, () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      return {
        x,
        y,
        size: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2, // Slight upward bias
        alpha: 1,
        decay: Math.random() * 0.02 + 0.01,
      };
    });

    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particlesRef.current.forEach((p) => {
        if (p.alpha <= 0) return;

        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // Gravity
        p.alpha -= p.decay;

        // Draw particle with glow
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDissolving, particleCount, duration]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Previous image (dissolving) - shown behind particles during transition */}
      {isDissolving && previousSrc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${previousSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0,
            animation: 'particleDissolveOut 0.4s ease-out forwards',
          }}
        />
      )}

      {/* Current image */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: src ? `url(${src})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: isDissolving ? 0 : 1,
          transition: 'opacity 0.5s ease-in',
          transitionDelay: isDissolving ? '0s' : '0.3s',
        }}
        aria-label={alt}
      />

      {/* Particle canvas overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Fallback gradient when no image */}
      {!src && !previousSrc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
          }}
        />
      )}

      {/* CSS animation keyframes */}
      <style>{`
        @keyframes particleDissolveOut {
          0% { opacity: 1; filter: blur(0px); }
          100% { opacity: 0; filter: blur(8px); }
        }
      `}</style>
    </div>
  );
});

ParticleDissolveImage.displayName = 'ParticleDissolveImage';
