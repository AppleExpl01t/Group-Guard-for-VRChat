import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Shield, Clock, Smartphone, Globe, Search, User, Activity } from 'lucide-react';

import styles from './AdminDashboard.module.css';

interface HWIDRecord { hwid: string; last_seen: string; }
interface IPRecord { ip_address: string; last_seen: string; }
interface AliasRecord { username: string; first_seen: string; }

export interface TrackedUser {
  vrc_userid: string;
  current_username?: string;
  tos_version?: string;
  last_seen: string;
  first_seen: string;
  hwids?: HWIDRecord[];
  ips?: IPRecord[];
  aliases?: AliasRecord[];
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

interface VRChatProfile {
  id: string;
  displayName: string;
  bio?: string;
  currentAvatarImageUrl?: string;
  currentAvatarThumbnailImageUrl?: string;
  status: string;
  statusDescription?: string;
  tags?: string[];
  userIcon?: string;
}

interface ElectronProfileResponse {
  success: boolean;
  data?: { profile: VRChatProfile };
  error?: string;
}

interface ElectronUserResponse {
  success: boolean;
  user?: VRChatProfile;
  error?: string;
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
  const [vrcProfile, setVrcProfile] = React.useState<VRChatProfile | null>(null);
  const [loadingVrc, setLoadingVrc] = React.useState(false);

  React.useEffect(() => {
    if (selectedUser?.vrc_userid) {
      setLoadingVrc(true);
      setVrcProfile(null);
      // Fetch VRChat profile using the existing Electron bridge
      (window.electron.userProfile.getCompleteData(selectedUser.vrc_userid) as Promise<ElectronProfileResponse>)
        .then((result) => {
          if (result.success && result.data) {
             setVrcProfile(result.data.profile);
             return undefined;
          } else {
             // Fallback to basic fetch if complete data fails
             return window.electron.getUser(selectedUser.vrc_userid) as Promise<ElectronUserResponse>;
          }
        })
        .then((basicResult) => {
           if (basicResult && basicResult.success && basicResult.user) {
              setVrcProfile(basicResult.user as VRChatProfile);
           }
        })
        .catch((err) => console.error("Failed to fetch VRChat profile", err))
        .finally(() => setLoadingVrc(false));
    } else {
      setVrcProfile(null);
    }
  }, [selectedUser]);

  const getTrustColor = (trustLevel: string) => {
      const r = (trustLevel || '').toLowerCase();
      // Updated specific colors, but keeping them somewhat distinct while fitting the dark theme
      // Using brighter/neon versions to pop against the dark background
      if (r.includes('trusted') || r.includes('veteran')) return '#c084fc'; // Brighter Purple
      if (r.includes('known')) return '#fb923c';   // Brighter Orange
      if (r.includes('new')) return '#60a5fa';     // Brighter Blue
      if (r.includes('user')) return '#4ade80';    // Brighter Green
      if (r.includes('visitor')) return '#9ca3af'; // Gray
      return '#666666';
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
                    key={user.vrc_userid}
                    onClick={() => onSelectUser(user.vrc_userid)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderLeft: selectedUser?.vrc_userid === user.vrc_userid ? '3px solid #22c55e' : '3px solid transparent',
                      background: selectedUser?.vrc_userid === user.vrc_userid ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(34, 197, 94, 0.1)',
                      transition: 'all 0.2s ease',
                      fontFamily: 'monospace'
                    }}
                    className="hover:bg-green-500/5"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                       <span style={{ fontWeight: 600, color: '#e4e4e7', fontSize: '0.9rem' }}>{user.current_username || 'UNKNOWN'}</span>
                       {user.tos_version && (
                         <span style={{ 
                           fontSize: '0.65rem', 
                           padding: '2px 6px', 
                           borderRadius: '4px', 
                           background: 'rgba(34, 197, 94, 0.2)', 
                           color: '#4ade80',
                           border: '1px solid rgba(34, 197, 94, 0.3)'
                         }}>v{user.tos_version}</span>
                       )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(34, 197, 94, 0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.vrc_userid}
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
                
                {/* VRChat Identity Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   {/* Top Row: Avatar + Name + Basic Stats */}
                   <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                      {/* Avatar */}
                      <div style={{ position: 'relative' }}>
                          {vrcProfile?.currentAvatarImageUrl ? (
                             <div style={{ 
                                width: '120px', height: '120px', 
                                borderRadius: '4px', overflow: 'hidden', 
                                border: '1px solid rgba(34, 197, 94, 0.5)',
                                boxShadow: '0 0 15px rgba(34, 197, 94, 0.2)',
                                flexShrink: 0
                             }}>
                                <img src={vrcProfile.currentAvatarImageUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             </div>
                           ) : (
                             <div style={{ 
                                width: '120px', height: '120px', 
                                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(0,0,0,0.8) 100%)', 
                                borderRadius: '4px', 
                                border: '1px solid rgba(34, 197, 94, 0.5)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '3.5rem', fontWeight: 'bold', color: '#22c55e',
                                boxShadow: '0 0 15px rgba(34, 197, 94, 0.2)',
                                flexShrink: 0
                             }}>
                                {selectedUser.current_username?.[0] || '?'}
                             </div>
                           )}
                           {loadingVrc && (
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                                 <Activity className="animate-spin text-[#22c55e]" size={24} />
                              </div>
                           )}
                      </div>

                      {/* Header Info */}
                      <div style={{ flex: 1, paddingTop: '0.25rem' }}>
                          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#22c55e', lineHeight: 1.1, letterSpacing: '0.05em', fontFamily: 'monospace', textTransform: 'uppercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.4)' }}>
                            {vrcProfile?.displayName || selectedUser.current_username}
                          </h1>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                             {vrcProfile && (
                                <span style={{ 
                                   color: getTrustColor(vrcProfile.tags?.find((t: string) => t.startsWith('system_trust'))?.split('_').pop() || 'visitor'),
                                   background: 'rgba(0,0,0,0.6)',
                                   fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid currentColor', padding: '2px 8px', borderRadius: '4px',
                                   fontFamily: 'monospace', textTransform: 'uppercase'
                                }}>
                                   {vrcProfile.tags?.find((t: string) => t.startsWith('system_trust'))?.split('_').pop()?.toUpperCase() || 'VISITOR'}
                                </span>
                             )}
                             
                             <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: 'rgba(34, 197, 94, 0.7)', fontFamily: 'monospace' }}>
                                <Shield size={14} />
                                <span>{selectedUser.vrc_userid}</span>
                             </div>

                             {vrcProfile?.status && (
                                 <span style={{ 
                                    fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', 
                                    background: vrcProfile.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : vrcProfile.status === 'join me' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    color: vrcProfile.status === 'active' ? '#4ade80' : vrcProfile.status === 'join me' ? '#60a5fa' : '#f87171',
                                    border: `1px solid ${vrcProfile.status === 'active' ? '#22c55e' : vrcProfile.status === 'join me' ? '#3b82f6' : '#ef4444'}`,
                                    fontWeight: 'bold', textTransform: 'uppercase', fontFamily: 'monospace'
                                 }}>
                                    {vrcProfile.status}
                                 </span>
                             )}
                          </div>

                          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                             <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <Clock size={14} />
                                <span>LAST SEEN: {new Date(selectedUser.last_seen).toLocaleDateString()}</span>
                             </div>
                          </div>
                      </div>
                   </div>

                   {/* Status & Bio Cards (Stacked) */}
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                      {/* Status Card */}
                      {vrcProfile?.statusDescription && (
                        <GlassCard style={{ padding: '1rem', background: 'rgba(0, 0, 0, 0.6)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                           <div style={{ 
                              fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', 
                              color: 'rgba(34, 197, 94, 0.7)', marginBottom: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' 
                           }}>
                              <Activity size={14} /> Status Message
                           </div>
                           <div style={{ fontSize: '1rem', color: '#a1a1aa', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'monospace' }}>
                              {vrcProfile.statusDescription}
                           </div>
                        </GlassCard>
                      )}

                      {/* Bio Card */}
                      {vrcProfile?.bio && (
                        <GlassCard style={{ padding: '1rem', background: 'rgba(0, 0, 0, 0.6)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                           <div style={{ 
                              fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', 
                              color: 'rgba(34, 197, 94, 0.7)', marginBottom: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' 
                           }}>
                              <User size={14} /> Biography
                           </div>
                           <div style={{ fontSize: '0.9rem', color: '#a1a1aa', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'monospace' }}>
                              {vrcProfile.bio}
                           </div>
                        </GlassCard>
                      )}
                   </div>
                </div>

                {/* Tracking Data Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                   {/* HWID Card */}
                   <GlassCard style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                         <Smartphone size={16} className="text-[#22c55e]" />
                         <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>Hardware Identity</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {selectedUser.hwids?.map((h, i) => (
                             <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                <span style={{ color: '#4ade80' }}>{h.hwid}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(h.last_seen).toLocaleDateString()}</span>
                             </div>
                          ))}
                          {(!selectedUser.hwids || selectedUser.hwids.length === 0) && (
                             <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>NO RECORDS</div>
                          )}
                      </div>
                   </GlassCard>

                   {/* IP Card */}
                   <GlassCard style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                         <Globe size={16} className="text-[#22c55e]" />
                         <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>Network Trace</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {selectedUser.ips?.map((ip, i) => (
                             <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                <span style={{ color: '#4ade80' }}>{ip.ip_address}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(ip.last_seen).toLocaleDateString()}</span>
                             </div>
                          ))}
                          {(!selectedUser.ips || selectedUser.ips.length === 0) && (
                             <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>NO RECORDS</div>
                          )}
                      </div>
                   </GlassCard>
                </div>

                {/* Aliases Card */}
                <GlassCard style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <User size={16} className="text-[#22c55e]" />
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>Username History</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                       {selectedUser.aliases?.map((a, i) => (
                          <div key={i} style={{ 
                             display: 'flex', alignItems: 'center', gap: '0.5rem',
                             background: 'rgba(0,0,0,0.4)', borderRadius: '4px',
                             padding: '0.4rem 0.8rem', border: '1px solid rgba(34, 197, 94, 0.2)'
                          }}>
                             <span style={{ color: '#e4e4e7', fontSize: '0.85rem', fontFamily: 'monospace' }}>{a.username}</span>
                             <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontFamily: 'monospace' }}>{new Date(a.first_seen).toLocaleDateString()}</span>
                          </div>
                       ))}
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
