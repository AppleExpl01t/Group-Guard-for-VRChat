import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from './GlassPanel';
import { useUIStore } from '../../stores/uiStore';
import styles from './Modal.module.css';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: string;
    closable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    footer,
    width = '500px',
    closable = true
}) => {


    const { incrementModalCount, decrementModalCount } = useUIStore();

    // Ensure we only render on client (standard check, though Electron is client)
    // Close on escape key
    useEffect(() => {
        if (isOpen) {
            incrementModalCount();
            // Cleanup: if unmounted while open, decrement
            return () => {
                decrementModalCount();
            };
        }
    }, [isOpen, incrementModalCount, decrementModalCount]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (closable && e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, closable]);



    return ReactDOM.createPortal(
        <AnimatePresence>
            {isOpen && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'auto' // Allow clicks to reach backdrop for close-on-click-outside
                    }}
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => closable && onClose()}
                        className={styles.backdrop}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.4)', // Less dark since blur handles focus
                            // backdropFilter removed to keep particles crisp!
                            pointerEvents: 'auto'
                        }}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={styles.modalParams}
                        style={{
                            position: 'relative', // Relative to flex container
                            zIndex: 10,
                            width: width,
                            maxWidth: '90vw',
                            pointerEvents: 'auto',
                            // Removed manual transform centering because Flexbox handles it
                        }}
                    >
                        <GlassPanel style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                            {/* Header */}
                            <div style={{ 
                                padding: '1.5rem', 
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.02)'
                            }}>
                                <h2 style={{ 
                                    margin: 0, 
                                    fontSize: '1.25rem', 
                                    fontWeight: 600,
                                    color: '#fff',
                                    textShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                                }}>
                                    {title}
                                </h2>
                                {closable && (
                                    <button 
                                        onClick={onClose}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--color-text-dim)',
                                            cursor: 'pointer',
                                            fontSize: '1.5rem',
                                            lineHeight: 1,
                                            padding: '5px',
                                            borderRadius: '4px',
                                            transition: 'color 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-dim)')}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                )}
                            </div>

                            {/* Body */}
                            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                                {children}
                            </div>

                            {/* Footer */}
                            {footer && (
                                <div style={{ 
                                    padding: '1.5rem', 
                                    borderTop: '1px solid var(--border-color)',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '1rem',
                                    background: 'rgba(255,255,255,0.02)'
                                }}>
                                    {footer}
                                </div>
                            )}
                        </GlassPanel>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

