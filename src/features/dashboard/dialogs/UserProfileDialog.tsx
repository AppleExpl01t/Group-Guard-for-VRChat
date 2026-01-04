import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import type { VRChatUser } from '../../../types/electron';

export const UserProfileDialog: React.FC = () => {
    const { isOpen, userId, closeProfile } = useUserProfileStore();
    const [user, setUser] = useState<VRChatUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            setError(null);
            setUser(null);
            
            window.electron.getUser(userId)
                .then(res => {
                    if (res.success && res.user) {
                        setUser(res.user);
                    } else {
                        setError(res.error || 'Failed to load user');
                    }
                })
                .catch(err => setError(String(err)))
                .finally(() => setLoading(false));
        }
    }, [isOpen, userId]);

    if (!isOpen) return null;

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'active': return '#5cc9f5'; // Blue
            case 'join me': return '#42b983'; // Blue-ish
            case 'busy': return '#ab1a1a'; // Red
            default: return '#888';
        }
    };
    
    // Status text (VRChat "status" is often "active", "join me", etc. "state" is offline/online?)
    // Actually VRChat API is a bit complex here. statusDescription is the custom text.
    // status is "active", "join me", "ask me", "busy", "offline".

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={closeProfile} 
            title={user?.displayName || 'User Profile'}
            width="600px"
        >
            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    Loading profile...
                </div>
            ) : error ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#ff4444' }}>
                    {error}
                </div>
            ) : user ? (
                <div style={{ padding: '10px' }}>
                    {/* Header: Avatar & Basic Info */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                        <div style={{ position: 'relative' }}>
                            <img 
                                src={user.profilePicOverride || user.currentAvatarImageUrl || user.userIcon} 
                                alt={user.displayName}
                                style={{ 
                                    width: '120px', 
                                    height: '120px', 
                                    borderRadius: '12px', 
                                    objectFit: 'cover',
                                    border: `2px solid ${getStatusColor(user.status)}`
                                }} 
                            />
                            <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {/* Age Verified Badge */}
                                {(user.ageVerified || user.tags?.includes('system_age_verified')) && (
                                    <div style={{
                                        background: '#fbbf24', // Amber/Gold
                                        color: '#000',
                                        padding: '2px 6px',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: '800',
                                        border: '2px solid rgba(0,0,0,0.5)'
                                    }}>
                                        18+
                                    </div>
                                )}
                                
                                <div style={{
                                    background: getStatusColor(user.status),
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    border: '2px solid #1a1b1e' // Match background? Or dark border
                                }}>
                                    {user.status || 'Offline'}
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ flex: 1 }}>
                            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', color: '#fff' }}>
                                {user.displayName}
                            </h2>
                            <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '10px' }}>
                                {user.statusDescription}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {user.tags?.map(tag => (
                                    <span key={tag} style={{ 
                                        background: 'rgba(255,255,255,0.1)', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        color: '#ccc'
                                    }}>
                                        {tag.replace('system_', '').replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bio */}
                    <GlassPanel style={{ padding: '15px', marginBottom: '15px' }}>
                        <h4 style={{ marginTop: 0, color: '#888', textTransform: 'uppercase', fontSize: '0.8rem' }}>Bio</h4>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', color: '#eee' }}>
                            {user.bio || 'No bio available.'}
                        </div>
                        
                        {user.bioLinks && user.bioLinks.length > 0 && (
                            <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                {user.bioLinks.map(link => (
                                    <a  key={link} 
                                        href={link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{ color: '#5cc9f5', textDecoration: 'none', fontSize: '0.9rem' }}
                                    >
                                        {link}
                                    </a>
                                ))}
                            </div>
                        )}
                    </GlassPanel>

                    {/* Details Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <GlassPanel style={{ padding: '15px' }}>
                            <div style={{ color: '#888', fontSize: '0.8rem' }}>Last Login</div>
                            <div>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Unknown'}</div>
                        </GlassPanel>
                        <GlassPanel style={{ padding: '15px' }}>
                            <div style={{ color: '#888', fontSize: '0.8rem' }}>Date Joined</div>
                            <div>{user.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'Unknown'}</div>
                        </GlassPanel>
                        <GlassPanel style={{ padding: '15px' }}>
                            <div style={{ color: '#888', fontSize: '0.8rem' }}>Trust Rank</div>
                            <div>{getTrustRank(user.tags)}</div>
                        </GlassPanel>
                         <GlassPanel style={{ padding: '15px' }}>
                            <div style={{ color: '#888', fontSize: '0.8rem' }}>Location</div>
                            <div>{user.location || user.state || 'Unknown'}</div>
                        </GlassPanel>
                    </div>

                </div>
            ) : null}
        </Modal>
    );
};

// Helper to deduce rank from tags because VRChat API doesn't send "trustRank" field directly typically, 
// unless we inspect tags like 'system_trust_veteran'.
function getTrustRank(tags: string[] = []): string {
    if (tags.includes('system_trust_legend')) return 'Legendary';
    if (tags.includes('system_trust_veteran')) return 'Veteran';
    if (tags.includes('system_trust_trusted')) return 'Trusted';
    if (tags.includes('system_trust_known')) return 'Known';
    if (tags.includes('system_trust_basic')) return 'User';
    if (tags.includes('system_probation')) return 'Visitor (Probation)'; // or similar
    // Default fallback
    return 'Visitor'; 
}
