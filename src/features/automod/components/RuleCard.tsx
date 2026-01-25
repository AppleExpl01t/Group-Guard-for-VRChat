import React, { memo, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface RuleCardProps {
    title: string;
    statusLabel: string;
    isEnabled: boolean;
    onToggle: () => void;
    icon: React.ReactNode;
    color: string;
    actionLabel?: string;
    onAction?: (e: React.MouseEvent) => void;
}

// PERF FIX: Memoized to prevent re-renders in rule lists
export const RuleCard: React.FC<RuleCardProps> = memo(({ 
    title, 
    statusLabel, 
    isEnabled, 
    onToggle, 
    icon, 
    color,
    actionLabel,
    onAction
}) => {
    // Memoize style objects to prevent recreation on each render
    const containerStyle = useMemo(() => ({ 
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.75rem',
        background: isEnabled ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderRadius: '8px',
        border: isEnabled ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    }), [isEnabled, color]);

    const iconWrapperStyle = useMemo(() => ({ 
        width: '32px', 
        height: '32px', 
        borderRadius: '6px', 
        background: isEnabled ? color : 'rgba(255,255,255,0.1)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: isEnabled ? 'black' : 'white',
        flexShrink: 0
    }), [isEnabled, color]);

    const titleStyle = useMemo(() => ({ 
        fontWeight: 600, 
        color: isEnabled ? 'white' : 'var(--color-text-dim)', 
        fontSize: '0.9rem' 
    }), [isEnabled]);

    const statusStyle = useMemo(() => ({ 
        fontSize: '0.75rem', 
        color: isEnabled ? color : 'rgba(255,255,255,0.3)', 
        marginTop: '2px' 
    }), [isEnabled, color]);

    const handleActionClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onAction?.(e);
    }, [onAction]);

    return (
        <motion.div 
            style={containerStyle}
            onClick={onToggle}
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
            <div style={iconWrapperStyle}>
                {icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={titleStyle}>
                    {title}
                </div>
                <div style={statusStyle}>
                    {statusLabel}
                </div>
            </div>

            {actionLabel && (
                <div style={{ display: 'flex', gap: '5px' }}>
                    {isEnabled && onAction && (
                        <button 
                            onClick={handleActionClick}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--color-text-dim)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-dim)'}
                        >
                            ⚙️
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    );
});

RuleCard.displayName = 'RuleCard';
