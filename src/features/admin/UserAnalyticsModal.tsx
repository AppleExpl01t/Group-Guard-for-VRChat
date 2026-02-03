import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Shield, Clock, Smartphone, Search, Activity } from 'lucide-react';

import styles from './AdminDashboard.module.css';

// New installation-based tracking (privacy-respecting)
export interface TrackedUser {
  uuid: string;
  first_seen: string;
  last_seen: string;
  app_version?: string;
}

interface UserAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackedUsers: TrackedUser[];
  selectedUser: TrackedUser | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectUser: (userId: string) => void;
}

export const UserAnalyticsModal: React.FC<UserAnalyticsModalProps> = ({
  isOpen,
  onClose,
  trackedUsers,
  selectedUser,
  searchQuery,
  onSearchChange,
  onSelectUser
}) => {
  // Note: VRChat profile fetching removed - we now track anonymous installations only

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString();
  };

  const formatTimeSince = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const isOnline = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs < 5 * 60 * 1000; // Active in last 5 mins
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Analytics Database"
      width="90vw"
      variant="admin"
      contentOverflow="hidden"
    >
      <div className="flex h-[70vh] gap-6" style={{ height: '70vh', display: 'flex', gap: '1.5rem', fontFamily: 'monospace', overflow: 'hidden' }}>
        {/* Left Sidebar: Search & List */}
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
             <Input 
              placeholder="SEARCH QUERY..." 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ 
                  paddingLeft: '2.5rem', 
                  background: 'rgba(0,0,0,0.6)', 
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#22c55e',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  fontSize: '0.8rem',
                  letterSpacing: '0.05em'
              }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#22c55e', pointerEvents: 'none', opacity: 0.7 }} />
          </div>
          
          <GlassCard style={{ flex: 1, overflow: 'hidden', padding: 0, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
             <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(34, 197, 94, 0.3)', fontSize: '0.75rem', color: 'rgba(34, 197, 94, 0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Database Results ({trackedUsers.length})
             </div>
             <div className={styles.customScrollbar} style={{ overflowY: 'auto', height: 'calc(100% - 40px)' }}>
                {trackedUsers.map(user => (
                  <div 
                    key={user.uuid}
                    onClick={() => onSelectUser(user.uuid)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderLeft: selectedUser?.uuid === user.uuid ? '3px solid #22c55e' : '3px solid transparent',
                      background: selectedUser?.uuid === user.uuid ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(34, 197, 94, 0.1)',
                      transition: 'all 0.2s ease',
                      fontFamily: 'monospace'
                    }}
                    className="hover:bg-green-500/5"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                       <span style={{ fontWeight: 600, color: '#e4e4e7', fontSize: '0.9rem' }}>{user.uuid.substring(0, 8)}...</span>
                       {user.app_version && (
                         <span style={{ 
                           fontSize: '0.65rem', 
                           padding: '2px 6px', 
                           borderRadius: '4px', 
                           background: 'rgba(34, 197, 94, 0.2)', 
                           color: '#4ade80',
                           border: '1px solid rgba(34, 197, 94, 0.3)'
                         }}>v{user.app_version}</span>
                       )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(34, 197, 94, 0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Last: {new Date(user.last_seen).toLocaleString()}
                    </div>
                  </div>
                ))}
             </div>
          </GlassCard>
        </div>

        {/* Right Panel: Details */}
        <div className={styles.customScrollbar} style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
           {selectedUser ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Installation Header */}
                <GlassCard style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                   <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                      {/* Icon */}
                      <div style={{ 
                         width: '80px', height: '80px', 
                         background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(0,0,0,0.8) 100%)', 
                         borderRadius: '8px', 
                         border: '1px solid rgba(34, 197, 94, 0.5)',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)',
                         flexShrink: 0
                      }}>
                         <Smartphone size={36} style={{ color: '#22c55e' }} />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                         <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#22c55e', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                            INSTALLATION
                         </h2>
                         <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                            {selectedUser.uuid}
                         </div>
                         
                         {/* Status Badge */}
                         <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <span style={{ 
                               padding: '4px 12px', 
                               borderRadius: '4px',
                               fontSize: '0.75rem',
                               fontWeight: 600,
                               fontFamily: 'monospace',
                               textTransform: 'uppercase',
                               background: isOnline(selectedUser.last_seen) ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                               color: isOnline(selectedUser.last_seen) ? '#4ade80' : '#f87171',
                               border: `1px solid ${isOnline(selectedUser.last_seen) ? '#22c55e' : '#ef4444'}`
                            }}>
                               {isOnline(selectedUser.last_seen) ? '● ONLINE' : '○ OFFLINE'}
                            </span>
                            {selectedUser.app_version && (
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                background: 'rgba(59, 130, 246, 0.2)',
                                color: '#60a5fa',
                                border: '1px solid #3b82f6'
                              }}>
                                v{selectedUser.app_version}
                              </span>
                            )}
                         </div>
                      </div>
                   </div>
                </GlassCard>

                {/* Timestamps */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                   <GlassCard style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                         <Clock size={16} style={{ color: '#22c55e' }} />
                         <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>First Seen</span>
                      </div>
                      <div style={{ fontSize: '1rem', color: '#e4e4e7', fontFamily: 'monospace' }}>
                         {formatTimestamp(selectedUser.first_seen)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                         {formatTimeSince(selectedUser.first_seen)}
                      </div>
                   </GlassCard>

                   <GlassCard style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                         <Activity size={16} style={{ color: '#22c55e' }} />
                         <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>Last Seen</span>
                      </div>
                      <div style={{ fontSize: '1rem', color: '#e4e4e7', fontFamily: 'monospace' }}>
                         {formatTimestamp(selectedUser.last_seen)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                         {formatTimeSince(selectedUser.last_seen)}
                      </div>
                   </GlassCard>
                </div>

                {/* Privacy Notice */}
                <GlassCard style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1rem' }}>
                   <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Shield size={18} style={{ color: '#60a5fa', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                         <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#60a5fa', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
                            PRIVACY-RESPECTING TRACKING
                         </div>
                         <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                            Only anonymous installation UUIDs are tracked. No VRChat IDs, usernames, IPs, or hardware fingerprints are collected.
                         </div>
                      </div>
                   </div>
                </GlassCard>

             </div>
           ) : (
             <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                <Activity size={64} style={{ marginBottom: '1rem', color: '#22c55e' }} />
                <p style={{ fontFamily: 'monospace', textTransform: 'uppercase', color: '#22c55e' }}>AWAITING USER SELECTION_</p>
             </div>
           )}
        </div>
      </div>
    </Modal>
  );
};
