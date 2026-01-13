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
}

export const GlobalModals: React.FC<GlobalModalsProps> = ({
  isLogoutConfirmOpen,
  setIsLogoutConfirmOpen,
  onLogoutConfirm,
  isUpdateReady
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
