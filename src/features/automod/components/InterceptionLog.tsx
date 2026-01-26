import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useUserProfileStore } from '../../../stores/userProfileStore';

export interface LogEntry {
    id: string;
    user: string;
    timestamp: number;
    action: string;
    reason: string;
    userId: string;
    groupId?: string;
    [key: string]: unknown;
}

interface InterceptionLogProps {
    logs: LogEntry[];
    onSelectEntry: (entry: LogEntry) => void;
}

export const InterceptionLog: React.FC<InterceptionLogProps> = ({ logs }) => {
    const { openProfile } = useUserProfileStore();

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
             <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Interception Audit Log</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                    {logs.length} events
                </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {logs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <AnimatePresence initial={false}>
                            {logs.map(log => (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    onClick={() => openProfile(log.userId)}
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '1rem', 
                                        padding: '0.75rem', 
                                        background: 'rgba(255,255,255,0.03)', 
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        cursor: 'pointer',
                                    }}
                                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                                >
                                    <div style={{ fontSize: '1.2rem' }}>
                                        {log.action === 'BLOCKED' ? '🚫' : '⚠️'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 600, color: 'white' }}>
                                                {log.user}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '0.1rem' }}>
                                            <span style={{ 
                                                fontSize: '0.75rem', 
                                                fontWeight: 'bold',
                                                color: log.action === 'BLOCKED' ? 'var(--color-danger)' : 'var(--color-success)'
                                            }}>
                                                {log.action}
                                            </span>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                                                {log.reason}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div style={{ 
                        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        color: 'var(--color-text-dim)', flexDirection: 'column', gap: '0.5rem' 
                    }}>
                       <span style={{ fontSize: '2rem' }}>🛡️</span>
                       <span>No interceptions recorded</span>
                    </div>
                )}
            </div>
        </div>
    );
};
