import React, { useState } from 'react';
import { NeonButton } from '../../components/ui/NeonButton';
import { Download, Trash2 } from 'lucide-react';
import { PrivacyDangerDialog } from './dialogs/PrivacyDangerDialog';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';

const innerCardStyle: React.CSSProperties = {
    background: 'var(--color-surface-card)',
    borderRadius: '12px',
    padding: '1.25rem',
    border: '1px solid var(--border-color)',
};

export const PrivacySettings: React.FC = () => {
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDangerDialog, setShowDangerDialog] = useState(false);
    const { addNotification } = useNotificationStore();
    const logout = useAuthStore(state => state.logout);

    const handleExport = async () => {
        setIsExporting(true);
        addNotification({ type: 'info', title: 'Exporting Data', message: 'Generating your data package...' });

        try {
            const result = await window.electron.identity.exportUserData();
            
            if (result.success && result.data) {
                // Trigger download
                const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `groupguard-data-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                addNotification({ type: 'success', title: 'Export Complete', message: 'Your data has been successfully exported.' });
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error: unknown) {
            console.error('Export error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addNotification({ type: 'error', title: 'Export Failed', message: errorMessage || 'Could not export data.' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const result = await window.electron.identity.deleteAccount();
            if (result.success) {
                addNotification({ type: 'success', title: 'Account Deleted', message: 'Your account has been permanently removed. Goodbye!' });
                
                // Wait briefly for notification to be seen
                setTimeout(() => {
                   logout();
                }, 1500);
            } else {
                throw new Error(result.error);
            }
        } catch (error: unknown) {
            console.error('Delete error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addNotification({ type: 'error', title: 'Deletion Failed', message: errorMessage || 'Could not delete account.' });
            setIsDeleting(false); // Only reset if failed, otherwise we are logging out
            setShowDangerDialog(false);
        }
    };

    return (
        <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-text-main)', fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Privacy & Data
            </h3>

            <div style={innerCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>Export My Data</div>
                        <div style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>Download a copy of your personal data held by GroupGuard.</div>
                    </div>
                    <NeonButton
                        variant="secondary"
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        <Download size={16} style={{ marginRight: '8px' }} />
                        {isExporting ? 'Exporting...' : 'Export JSON'}
                    </NeonButton>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <div>
                        <div style={{ color: '#ef4444', fontWeight: 600 }}>Delete Account</div>
                        <div style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>Permanently remove your account and all associated data.</div>
                    </div>
                    <NeonButton
                        variant="danger"
                        onClick={() => setShowDangerDialog(true)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                    >
                        <Trash2 size={16} style={{ marginRight: '8px' }} />
                        Delete Account
                    </NeonButton>
                </div>
            </div>

            <PrivacyDangerDialog
                isOpen={showDangerDialog}
                onClose={() => setShowDangerDialog(false)}
                onConfirm={handleDeleteAccount}
                isLoading={isDeleting}
            />
        </div>
    );
};
