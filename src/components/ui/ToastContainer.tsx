import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '../../stores/notificationStore';
import { Toast } from './Toast';

export const ToastContainer: React.FC = () => {
    const notifications = useNotificationStore(state => state.notifications);

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999, // Above everything
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            pointerEvents: 'none' // Let clicks pass through container area
        }}>
            <AnimatePresence mode='popLayout'>
                {notifications.map(notification => (
                    <Toast key={notification.id} notification={notification} />
                ))}
            </AnimatePresence>
        </div>
    );
};
