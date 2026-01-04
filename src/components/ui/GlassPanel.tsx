import React, { ReactNode } from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', style, ...props }) => {
  return (
    <div 
      className={`glass-panel ${className}`} 
      style={{
        padding: '1.5rem',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
};
