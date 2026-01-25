import React, { type ReactNode, memo, useMemo } from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

// PERF FIX: Memoized to prevent re-renders when parent updates
export const GlassPanel: React.FC<GlassPanelProps> = memo(({ children, className = '', style, ...props }) => {
  // Memoize combined style to prevent object recreation
  const combinedStyle = useMemo(() => ({
    padding: '1.5rem',
    ...style
  }), [style]);

  return (
    <div 
      className={`glass-panel ${className}`} 
      style={combinedStyle}
      {...props}
    >
      {children}
    </div>
  );
});

GlassPanel.displayName = 'GlassPanel';
