import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { type Notification, useNotificationStore } from '../../stores/notificationStore';
import { GlassPanel } from './GlassPanel';

interface ToastProps {
    notification: Notification;
}

const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    automod: '🛡️'
};

const colors = {
    success: 'var(--color-success)',
    error: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
    automod: '#f472b6' // Pink/Magenta for AutoMod
};

export const Toast: React.FC<ToastProps> = ({ notification }) => {
    const removeNotification = useNotificationStore(state => state.removeNotification);
    const { id, type, title, message, duration = 5000 } = notification;

    useEffect(() => {
        const timer = setTimeout(() => {
            removeNotification(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, removeNotification]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            style={{ 
                marginBottom: '1rem', 
                position: 'relative', 
                minWidth: '300px',
                maxWidth: '400px',
                pointerEvents: 'auto' // Re-enable clicks
            }}
        >
            <GlassPanel style={{ 
                padding: '1rem',
                borderLeft: `4px solid ${colors[type] || 'white'}`,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5)`,
                display: 'flex',
                alignItems: 'start',
                gap: '12px'
            }}>
                <div style={{ fontSize: '1.5rem' }}>{icons[type] || '📝'}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white', marginBottom: '4px' }}>
                        {title}
                    </div>
                    {message && (
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.4' }}>
                            {message}
                        </div>
                    )}
                </div>
                <button 
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(id);
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '1rem'
                    }}
                >
                    ✕
                </button>
            </GlassPanel>

            {/* Progress Bar (Optional, can add later if requested) */}
        </motion.div>
    );
};
