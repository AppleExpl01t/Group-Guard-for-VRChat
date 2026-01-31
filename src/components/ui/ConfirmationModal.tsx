import React from 'react';
import { Modal } from './Modal';
import { NeonButton } from './NeonButton';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default' | 'warning' | 'success';
    isLoading?: boolean;
    hideCancel?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    isLoading = false,
    hideCancel = false
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={isLoading ? () => { } : onClose}
            title={title}
            width="450px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: '50%',
                        background: variant === 'danger' ? 'rgba(239, 68, 68, 0.1)' : variant === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: variant === 'danger' ? '#ef4444' : variant === 'success' ? '#22c55e' : '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        {isLoading ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            >
                                <Loader2 size={24} />
                            </motion.div>
                        ) : (
                            variant === 'danger' ? <AlertTriangle size={24} /> : <Info size={24} />
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
                            {message}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {!hideCancel && (
                        <NeonButton
                            variant="ghost"
                            onClick={onClose}
                            size="sm"
                            disabled={isLoading}
                        >
                            {cancelLabel}
                        </NeonButton>
                    )}
                    <NeonButton
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={onConfirm}
                        size="sm"
                        autoFocus
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                >
                                    <Loader2 size={16} />
                                </motion.div>
                                Processing...
                            </span>
                        ) : confirmLabel}
                    </NeonButton>
                </div>
            </div>
        </Modal>
    );
};
