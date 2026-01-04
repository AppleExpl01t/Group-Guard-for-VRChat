/**
 * Pipeline Status Indicator
 * 
 * Shows the WebSocket connection status with a colored indicator dot.
 * Useful for debugging and showing users that real-time updates are active.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { usePipelineStatus } from '../../hooks/usePipelineInit';

interface PipelineStatusProps {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PipelineStatus: React.FC<PipelineStatusProps> = ({ 
  showText = true,
  size = 'sm'
}) => {
  const { connected, connecting, error } = usePipelineStatus();

  const getStatusColor = () => {
    if (error) return '#ef4444'; // Red
    if (connected) return '#22c55e'; // Green
    if (connecting) return '#f59e0b'; // Yellow/Orange
    return '#6b7280'; // Gray (disconnected)
  };

  const getStatusText = () => {
    if (error) return 'Connection Error';
    if (connected) return 'Live';
    if (connecting) return 'Connecting...';
    return 'Offline';
  };

  const dotSize = {
    sm: 8,
    md: 10,
    lg: 12
  }[size];

  const fontSize = {
    sm: '0.7rem',
    md: '0.8rem',
    lg: '0.9rem'
  }[size];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      {/* Animated status dot */}
      <motion.div
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          boxShadow: connected ? `0 0 8px ${getStatusColor()}` : 'none',
        }}
        animate={connecting ? {
          scale: [1, 1.2, 1],
          opacity: [1, 0.7, 1],
        } : connected ? {
          scale: [1, 1.1, 1],
        } : {}}
        transition={{
          duration: connecting ? 1 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {showText && (
        <span style={{
          fontSize,
          color: connected ? 'var(--color-text-dim)' : 'var(--color-text-muted)',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
};

/**
 * Compact pipeline indicator for header/footer
 */
export const PipelineIndicator: React.FC = () => {
  const { connected, connecting } = usePipelineStatus();

  return (
    <motion.div
      title={connected ? 'Real-time updates active' : connecting ? 'Connecting...' : 'Offline'}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: connected ? '#22c55e' : connecting ? '#f59e0b' : '#6b7280',
        boxShadow: connected ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none',
      }}
      animate={connected ? {
        scale: [1, 1.2, 1],
      } : {}}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
};
