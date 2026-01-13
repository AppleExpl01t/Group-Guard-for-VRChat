import React from 'react';
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
    children?: React.ReactNode;
}

export const RuleCard: React.FC<RuleCardProps> = ({ 
    title, 
    statusLabel, 
    isEnabled, 
    onToggle, 
    icon, 
    color,
    actionLabel,
    onAction,
    children
}) => {
    return (
        <motion.div 
            style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem',
                background: isEnabled ? 'rgba(255,255,255,0.03)' : 'transparent',
                borderRadius: '8px',
                border: isEnabled ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
            }}
            onClick={onToggle}
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
            <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '8px', 
                background: isEnabled ? color : 'rgba(255,255,255,0.1)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: isEnabled ? 'black' : 'white',
                flexShrink: 0
            }}>
                {icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: isEnabled ? 'white' : 'var(--color-text-dim)', fontSize: '0.95rem' }}>
                    {title}
                </div>
                <div style={{ fontSize: '0.75rem', color: isEnabled ? color : 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                    {statusLabel}
                </div>
            </div>

            {actionLabel && (
                <div style={{ display: 'flex', gap: '5px' }}>
                    {isEnabled && onAction && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction(e);
                            }}
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
};
