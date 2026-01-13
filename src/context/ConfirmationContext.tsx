/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default' | 'warning';
}

interface ConfirmationContextType {
    confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export const useConfirm = () => {
    const context = useContext(ConfirmationContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmationProvider');
    }
    return context;
};

export const ConfirmationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<ConfirmOptions>({
        title: 'Confirm Action',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        variant: 'default'
    });

    const resolveRef = useRef<(value: boolean) => void>(() => {});

    const confirm = useCallback((options: ConfirmOptions | string) => {
        const finalOptions = typeof options === 'string' 
            ? { message: options, title: 'Confirm Action', variant: 'default' as const } 
            : { title: 'Confirm Action', variant: 'default' as const, ...options };

        setConfig(finalOptions);
        setIsOpen(true);

        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setIsOpen(false);
        resolveRef.current(true);
    }, []);

    const handleCancel = useCallback(() => {
        setIsOpen(false);
        resolveRef.current(false);
    }, []);

    return (
        <ConfirmationContext.Provider value={{ confirm }}>
            {children}
            {isOpen && (
                <ConfirmationModal
                    isOpen={isOpen}
                    onClose={handleCancel}
                    onConfirm={handleConfirm}
                    title={config.title!}
                    message={config.message}
                    confirmLabel={config.confirmLabel}
                    cancelLabel={config.cancelLabel}
                    variant={config.variant}
                />
            )}
        </ConfirmationContext.Provider>
    );
};
