import React from 'react';
import { Modal } from '../ui/Modal';
import { NeonButton } from '../ui/NeonButton';
import { UserProfileDialog } from '../../features/dashboard/dialogs/UserProfileDialog';
import { Download } from 'lucide-react';

interface GlobalModalsProps {
  isLogoutConfirmOpen: boolean;
  setIsLogoutConfirmOpen: (open: boolean) => void;
  onLogoutConfirm: () => void;
  isUpdateReady: boolean;
  updateProgress: number | null;
}

export const GlobalModals: React.FC<GlobalModalsProps> = ({
  isLogoutConfirmOpen,
  setIsLogoutConfirmOpen,
  onLogoutConfirm,
  isUpdateReady,
  updateProgress
}) => {
  return (
    <>
      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        title="Confirm Logout"
        width="400px"
        footer={
            <>
                <NeonButton 
                    variant="ghost" 
                    onClick={() => setIsLogoutConfirmOpen(false)}
                >
                    Cancel
                </NeonButton>
                <NeonButton 
                    variant="danger" 
                    onClick={onLogoutConfirm}
                >
                    Logout
                </NeonButton>
            </>
        }
      >
        <div style={{ color: 'var(--color-text-dim)', lineHeight: '1.6' }}>
            Are you sure you want to log out?
            <br />
            You can receive a quick login (without 2FA) next time if you don't clear your credentials.
        </div>
      </Modal>

      {/* Global User Profile Dialog (Controlled by its own store) */}
      <UserProfileDialog />

      {/* Download Progress Toast */}
      {updateProgress !== null && (
        <div style={{ 
            position: 'fixed', 
            bottom: 20, 
            right: 20, 
            background: 'var(--color-surface-hover)', 
            padding: '12px', 
            borderRadius: '8px', 
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            border: '1px solid var(--color-border)',
            width: '240px'
        }}>
            <div style={{ color: 'var(--color-text-bright)', marginBottom: 8, fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Downloading Update...</span>
                <span>{Math.round(updateProgress)}%</span>
            </div>
            <div style={{ width: '100%', height: 4, background: 'var(--color-surface)', borderRadius: 2 }}>
                <div style={{ 
                    width: `${updateProgress}%`, 
                    height: '100%', 
                    background: 'var(--color-primary)', 
                    borderRadius: 2,
                    transition: 'width 0.2s ease-out'
                }} />
            </div>
        </div>
      )}

      {/* Update Available Modal (Non-escapable) */}
      <Modal
          isOpen={isUpdateReady}
          onClose={() => {}} // No-op, not closable
          closable={false}
          title="Update Ready"
          width="450px"
          footer={
              <NeonButton 
                  onClick={() => window.electron.updater.quitAndInstall()}
                  style={{ width: '100%' }}
                  glow
              >
                  Restart & Install Update
              </NeonButton>
          }
      >
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ 
                  background: 'hsla(var(--primary-hue), 100%, 50%, 0.1)', 
                  color: 'var(--color-primary)',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem auto'
              }}>
                  <Download size={32} />
              </div>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'white' }}>
                  New Version Downloaded
              </p>
              <p style={{ color: 'var(--color-text-dim)', lineHeight: '1.6', margin: 0 }}>
                  A critical update has been downloaded automatically. 
                  <br />
                  Please restart the application to apply the latest security patches and features.
              </p>
          </div>
      </Modal>
    </>
  );
};
