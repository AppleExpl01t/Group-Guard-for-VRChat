import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Plug, Info } from 'lucide-react';

import { Bug } from 'lucide-react';

export type SettingsTab = 'general' | 'integrations' | 'about' | 'debug';

interface SettingsTabBarProps {
    activeTab: SettingsTab;
    onTabChange: (tab: SettingsTab) => void;
    tabCounts?: Record<SettingsTab, number>;
    showDebug?: boolean;
}

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings size={16} /> },
    { id: 'integrations', label: 'Integrations', icon: <Plug size={16} /> },
    { id: 'about', label: 'About', icon: <Info size={16} /> },
    { id: 'debug', label: 'Debug', icon: <Bug size={16} /> },
];

export const SettingsTabBar: React.FC<SettingsTabBarProps> = ({ 
    activeTab, 
    onTabChange,
    tabCounts,
    showDebug = false
}) => {
    const visibleTabs = tabs.filter(t => t.id !== 'debug' || showDebug);

    return (
        <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '0',
        }}>
            {visibleTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const count = tabCounts?.[tab.id];
                
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1.25rem',
                            background: 'transparent',
                            border: 'none',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-dim)',
                            fontSize: '0.95rem',
                            fontWeight: isActive ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'color 0.2s ease',
                            marginBottom: '-1px',
                        }}
                    >
                        <span style={{ 
                            opacity: isActive ? 1 : 0.7,
                            transition: 'opacity 0.2s ease'
                        }}>
                            {tab.icon}
                        </span>
                        <span>{tab.label}</span>
                        
                        {/* Show count badge during search */}
                        {count !== undefined && count > 0 && (
                            <span style={{
                                background: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                color: isActive ? 'black' : 'var(--color-text-dim)',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                padding: '0.1rem 0.4rem',
                                borderRadius: '10px',
                                minWidth: '18px',
                                textAlign: 'center',
                            }}>
                                {count}
                            </span>
                        )}
                        
                        {/* Active indicator underline */}
                        {isActive && (
                            <motion.div
                                layoutId="settings-tab-indicator"
                                style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    height: '2px',
                                    background: 'var(--color-primary)',
                                    boxShadow: '0 0 10px var(--color-primary), 0 0 20px var(--color-primary)',
                                }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
