import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { NeonButton } from '../../../components/ui/NeonButton';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface PrivacyDangerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export const PrivacyDangerDialog: React.FC<PrivacyDangerDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const isMatch = confirmInput === 'DELETE';

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      title="Danger Zone: Delete Account"
      width="450px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--border-radius)',
          padding: '1rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'start'
        }}>
          <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#ef4444', fontSize: '1rem' }}>Permanent Action</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-dim)', lineHeight: '1.4' }}>
              This action <strong>cannot be undone</strong>. Your account, including ID, trust score, and reports (anonymized), will be permanently deleted.
            </p>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
            Type <strong>DELETE</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--color-bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--color-text-main)',
              outline: 'none',
              fontSize: '1rem',
              letterSpacing: '1px'
            }}
            placeholder="DELETE"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <NeonButton
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </NeonButton>
          <NeonButton
            variant="danger"
            onClick={onConfirm}
            disabled={!isMatch || isLoading}
            style={{ opacity: isMatch ? 1 : 0.5 }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <Loader2 size={16} />
                </motion.div>
                Deleting...
              </span>
            ) : (
              'Permanently Delete'
            )}
          </NeonButton>
        </div>
      </div>
    </Modal>
  );
};
