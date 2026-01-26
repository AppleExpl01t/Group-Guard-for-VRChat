import React, { memo } from 'react';
import { motion } from 'framer-motion';

interface LiveBadgeProps {
  /** Size variant */
  size?: 'sm' | 'md';
  /** Custom color (defaults to success green) */
  color?: string;
}

export const LiveBadge: React.FC<LiveBadgeProps> = memo(({ 
  size = 'md',
  color = 'var(--color-success)'
}) => {
  const dotSize = size === 'sm' ? 4 : 6;
  const fontSize = size === 'sm' ? '0.55rem' : '0.65rem';
  const padding = size === 'sm' ? '2px 6px' : '4px 8px';

  return (
    <motion.div 
      title="Synced with your local VRChat logs."
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: `color-mix(in srgb, ${color}, transparent 90%)`,
        padding,
        borderRadius: '12px',
        border: `1px solid color-mix(in srgb, ${color}, transparent 80%)`,
        cursor: 'help',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      whileHover={{
        background: `color-mix(in srgb, ${color}, transparent 80%)`,
        borderColor: `color-mix(in srgb, ${color}, transparent 60%)`,
      }}
    >
      {/* Scanline effect overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: 0.3,
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100%',
          background: `linear-gradient(
            180deg,
            transparent 0%,
            ${color}20 50%,
            transparent 100%
          )`,
          animation: 'scanline 2s linear infinite',
        }} />
      </div>

      {/* Pulsing dot with radar rings */}
      <div style={{ position: 'relative', width: `${dotSize}px`, height: `${dotSize}px` }}>
        {/* Core dot */}
        <motion.div 
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            backgroundColor: color,
            borderRadius: '50%',
            position: 'absolute',
            top: 0,
            left: 0,
            boxShadow: `0 0 ${dotSize * 2}px ${color}`,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.8, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Radar ring 1 */}
        <motion.div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '100%',
            height: '100%',
            backgroundColor: color,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: [1, 3, 4],
            opacity: [0.6, 0.2, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
        
        {/* Radar ring 2 (offset) */}
        <motion.div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '100%',
            height: '100%',
            backgroundColor: color,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: [1, 3, 4],
            opacity: [0.6, 0.2, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeOut',
            delay: 1,
          }}
        />
      </div>

      {/* LIVE text */}
      <span style={{
        fontSize,
        fontWeight: 700,
        color,
        letterSpacing: '0.5px',
        position: 'relative',
        zIndex: 1,
        textShadow: `0 0 10px ${color}`,
      }}>LIVE</span>

      {/* Scanline keyframes */}
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </motion.div>
  );
});

LiveBadge.displayName = 'LiveBadge';
