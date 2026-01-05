import React, { memo } from 'react';

export type DockView = 'main' | 'moderation' | 'audit' | 'database' | 'settings' | 'live';

interface NeonDockProps {
  currentView: DockView;
  onViewChange: (view: DockView) => void;
  selectedGroup?: { name: string } | null;
  onGroupClick?: () => void;
  isLiveMode?: boolean;
}

// Memoized dock item to prevent re-renders
const DockItem = memo<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  color?: string;
}>(({ label, isActive, onClick, icon, color = 'var(--color-primary)' }) => {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem',
        cursor: 'pointer',
        padding: '8px',
        position: 'relative',
        color: isActive ? 'white' : 'var(--color-text-dim)',
        minWidth: '70px',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        transition: 'transform 0.15s ease, color 0.15s ease',
        transform: 'translateZ(0)', // GPU layer
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1) translateY(-3px) translateZ(0)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateZ(0)';
      }}
    >
      {/* Glow Effect behind active item */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)`,
            opacity: 0.4,
            filter: 'blur(10px)',
            zIndex: -1,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}

      <div style={{ 
        position: 'relative',
        filter: isActive ? `drop-shadow(0 0 8px ${color})` : 'none',
        transition: 'filter 0.2s ease'
      }}>
        {icon}
      </div>
      
      <span style={{ 
        fontSize: '0.75rem', 
        fontWeight: isActive ? 600 : 400,
        opacity: isActive ? 1 : 0.7,
        transition: 'opacity 0.2s ease, font-weight 0.2s ease'
      }}>
        {label}
      </span>
      
      {/* Active Indicator Dot */}
      {isActive && (
        <div 
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
            marginTop: '0.2rem',
            transition: 'all 0.2s ease',
          }}
        />
      )}
    </button>
  );
});

DockItem.displayName = 'DockItem';

export const NeonDock: React.FC<NeonDockProps> = memo(({ 
  currentView, 
  onViewChange, 
  selectedGroup,
  onGroupClick,
  isLiveMode = false
}) => {
  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 1000,
      pointerEvents: 'none'
    }}>
      <div 
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '4px 6px',
          background: 'rgba(10, 10, 15, 0.45)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 50,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
          maxWidth: '90vw',
          width: 'fit-content',
          height: 'fit-content',
          overflow: 'hidden',
          transform: 'translateZ(0)', // GPU compositing
        }}
      >
        <DockItem 
          label={selectedGroup ? "Group" : "Home"}
          isActive={!selectedGroup}
          onClick={onGroupClick || (() => {})}
          color="var(--color-primary)"
          icon={
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
               <polyline points="9 22 9 12 15 12 15 22"></polyline>
             </svg>
          }
        />

        {/* Group-specific items - using CSS transitions instead of Framer Motion */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            overflow: 'hidden',
            maxWidth: selectedGroup ? '800px' : '0px',
            opacity: selectedGroup ? 1 : 0,
            transition: 'max-width 0.25s ease-out, opacity 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingRight: '0.25rem' }}>
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem', flexShrink: 0 }} />

            <DockItem 
              label="Dashboard"
              isActive={currentView === 'main' && !!selectedGroup}
              onClick={() => onViewChange('main')}
              color="var(--color-accent)"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              }
            />

            {/* LIVE OPS TAB - Only visible when Active */}
            <div style={{ 
                maxWidth: isLiveMode ? '100px' : '0px', 
                overflow: 'hidden', 
                opacity: isLiveMode ? 1 : 0,
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                <DockItem 
                  label="LIVE OPS"
                  isActive={currentView === 'live'}
                  onClick={() => onViewChange('live')}
                  color="#ef4444" // Red for alert/action
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  }
                />
            </div>

            <DockItem 
              label="Auto-Mod"
              isActive={currentView === 'moderation'}
              onClick={() => onViewChange('moderation')}
              color="var(--color-primary)"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              }
            />

            <DockItem 
              label="Audit Logs"
              isActive={currentView === 'audit'}
              onClick={() => onViewChange('audit')}
              color="var(--color-accent)"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              }
            />

            <DockItem 
              label="Database"
              isActive={currentView === 'database'}
              onClick={() => onViewChange('database')}
              color="var(--color-primary)"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
              }
            />
          </div>
        </div>

      </div>
    </div>
  );
});

NeonDock.displayName = 'NeonDock';
