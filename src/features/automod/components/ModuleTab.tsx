import React from 'react';
import { motion } from 'framer-motion';

interface ModuleTabProps {
    active: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

export const ModuleTab: React.FC<ModuleTabProps> = ({ active, label, icon, onClick }) => (
    <button
        onClick={onClick}
        style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            padding: '12px 24px',
            color: active ? 'white' : 'var(--color-text-dim)',
            fontWeight: 800,
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color 0.3s ease',
            outline: 'none',
            zIndex: 1
        }}
    >
        <span style={{ fontSize: '1.2rem', opacity: active ? 1 : 0.7 }}>{icon}</span>
        {label}
        
        {/* Active Indicator & Glow - "Sci-Fi Underline" */}
        {active && (
            <motion.div
                layoutId="activeTab"
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--color-primary)',
                    boxShadow: '0 -2px 10px var(--color-primary)',
                    borderRadius: '2px'
                }}
            />
        )}
        
        {/* Subtle Background Highlight on Active */}
        {active && (
            <motion.div
                layoutId="activeTabBg"
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(var(--primary-hue), 100%, 50%, 0.1) 0%, transparent 100%)',
                    borderRadius: '8px 8px 0 0',
                    zIndex: -1
                }}
            />
        )}
    </button>
);
