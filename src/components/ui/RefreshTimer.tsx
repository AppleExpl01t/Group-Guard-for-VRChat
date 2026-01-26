import React, { useEffect, useState } from 'react';
import { formatCountdown } from '../../hooks/useDataRefresh';

interface RefreshTimerProps {
  nextRefreshAt: number;
  isRefreshing: boolean;
  onRefreshClick?: (e?: React.MouseEvent) => void;
  label?: string;
  forceShowTimer?: boolean;
}

/**
 * Compact visual countdown timer for data refresh.
 * Internalizes the countdown logic to prevent parent re-renders.
 */
export const RefreshTimer: React.FC<RefreshTimerProps> = ({ 
  nextRefreshAt, 
  isRefreshing,
  onRefreshClick,
  label = 'Refresh',
  forceShowTimer = false
}) => {
  // Local state for the tick
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Only tick if we have a future date and not currently refreshing
    if (isRefreshing || !nextRefreshAt) return;

    // Tick every second to update 'now'
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRefreshing, nextRefreshAt]);

  const secondsUntilRefresh = Math.max(0, Math.ceil((nextRefreshAt - now) / 1000));
  const isOnCooldown = secondsUntilRefresh > 0;
  const isDisabled = isRefreshing || isOnCooldown;
  
  // Decide if we show the timer
  // If nextRefreshAt is 0, it means it's ready/unknown, so don't show timer unless forcing
  const showTimer = (isOnCooldown || isRefreshing || forceShowTimer) && nextRefreshAt > 0;

  return (
    <button
      onClick={onRefreshClick}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        background: 'transparent',
        border: 'none',
        padding: '2px 4px',
        fontSize: '0.65rem',
        color: 'var(--color-text-dim)',
        cursor: isDisabled ? 'default' : 'pointer',
        transition: 'color 0.15s ease',
        opacity: isOnCooldown ? 0.5 : 0.7,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.color = 'var(--color-primary)';
          e.currentTarget.style.opacity = '1';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--color-text-dim)';
        e.currentTarget.style.opacity = isOnCooldown ? '0.5' : '0.7';
      }}
      title={secondsUntilRefresh > 0 ? `${label} in ${formatCountdown(secondsUntilRefresh)}` : 'Click to refresh'}
    >
      {/* Tiny rotating icon */}
      <svg 
        width="9" 
        height="9" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{
          animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
        }}
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
      </svg>
      
      {/* Timer countdown */}
      {(showTimer) && (
        <span style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.6rem',
          letterSpacing: '-0.02em',
        }}>
          {isRefreshing ? '•••' : formatCountdown(secondsUntilRefresh)}
        </span>
      )}

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
};
