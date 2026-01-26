import React from 'react';
import { Modal } from './Modal';
import { NeonButton } from './NeonButton';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default' | 'warning';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default'
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            width="450px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: '50%',
                        background: variant === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: variant === 'danger' ? '#ef4444' : '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        {variant === 'danger' ? <AlertTriangle size={24} /> : <Info size={24} />}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
                            {message}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <NeonButton variant="ghost" onClick={onClose} size="sm">
                        {cancelLabel}
                    </NeonButton>
                    <NeonButton 
                        variant={variant === 'danger' ? 'danger' : 'primary'} 
                        onClick={onConfirm}
                        size="sm"
                        autoFocus
                    >
                        {confirmLabel}
                    </NeonButton>
                </div>
            </div>
        </Modal>
    );
};
