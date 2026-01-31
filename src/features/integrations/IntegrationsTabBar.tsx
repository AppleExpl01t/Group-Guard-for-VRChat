import React from 'react';
import { motion } from 'framer-motion';
import { Radio, MessageSquare, Sparkles } from 'lucide-react';

export type IntegrationTab = 'discord' | 'osc' | 'coming-soon';

interface IntegrationsTabBarProps {
    activeTab: IntegrationTab;
    onTabChange: (tab: IntegrationTab) => void;
}

const tabs: { id: IntegrationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'discord', label: 'Discord', icon: <MessageSquare size={16} /> },
    { id: 'osc', label: 'OSC', icon: <Radio size={16} /> },
    { id: 'coming-soon', label: 'Coming Soon!', icon: <Sparkles size={16} /> },
];

export const IntegrationsTabBar: React.FC<IntegrationsTabBarProps> = ({
    activeTab,
    onTabChange,
}) => {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '0',
            overflow: 'hidden',
            width: '100%',
        }}>
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'center', // Center the group of tabs
                width: '100%',
                maxWidth: '800px', // Same max-width as settings for continuity
            }}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1rem',
                                background: 'transparent',
                                border: 'none',
                                color: isActive ? 'var(--color-primary)' : 'var(--color-text-dim)',
                                fontSize: '0.9rem',
                                fontWeight: isActive ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'color 0.2s ease',
                                marginBottom: '-1px',
                                whiteSpace: 'nowrap',
                                minWidth: '160px', // Ensure they look like robust tabs
                                opacity: isActive ? 1 : 0.7,
                            }}
                        >
                            <span style={{
                                transition: 'transform 0.2s ease',
                                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                            }}>
                                {tab.icon}
                            </span>
                            <span>{tab.label}</span>

                            {isActive && (
                                <motion.div
                                    layoutId="integrations-tab-indicator"
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        height: '2px',
                                        background: 'var(--color-primary)',
                                        boxShadow: '0 0 10px var(--color-primary), 0 0 20px var(--color-primary)',
                                        zIndex: 1,
                                    }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
