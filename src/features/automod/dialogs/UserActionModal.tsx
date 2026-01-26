import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { useGroupStore } from '../../../stores/groupStore';

import { AnimatePresence, motion } from 'framer-motion';
import { TagBadge } from '../components/TagBadge';
import { getTrustColor, parseUserTags } from '../utils/automodHelpers';
import { NeonButton } from '../../../components/ui/NeonButton';
import { Button } from '../../../components/ui/Button';
import { useNotificationStore } from '../../../stores/notificationStore';

// --- User Action Modal ---
export const UserActionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntry: any;
    onActionComplete: () => void;
}> = ({ isOpen, onClose, logEntry, onActionComplete }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchUser = React.useCallback(async () => {
        if (!logEntry?.userId) return;
        setLoading(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (window as any).electron.getUser(logEntry.userId);
            // API returns { success: true, user: userData }
            if (response?.success && response?.user) {
                setUser(response.user);
            } else {
                console.error('Failed to fetch user:', response?.error);
                setUser(null);
            }
        } catch (e) {
            console.error('Failed to fetch user', e);
            setUser(null);
        }
        setLoading(false);
    }, [logEntry]);

    React.useEffect(() => {
        if (isOpen && logEntry?.userId) {
            fetchUser();
        } else {
            setUser(null);
        }
    }, [isOpen, logEntry?.userId, fetchUser]);

    const { selectedGroup } = useGroupStore();
    const { addNotification } = useNotificationStore();

    const handleAction = async (action: string, shouldClose = true) => {
        if (!logEntry?.userId) return;
        
        // Use log's group ID if available, otherwise fallback to currently selected group
        const groupId = logEntry.groupId || selectedGroup?.id;
        
        if (!groupId || groupId === 'grp_unknown') {
            addNotification({
                type: 'error',
                title: 'Action Failed',
                message: "Could not determine which Group to perform this action for. Please ensure you have a Group selected in the Dashboard."
            });
            return;
        }

        setActionLoading(action);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const electron = (window as any).electron;
            
            let result: { success: boolean; error?: string } = { success: false };
            
            switch (action) {
                case 'invite':
                    result = await electron.instance.recruitUser(groupId, logEntry.userId);
                    break;
                case 'unban':
                    result = await electron.instance.unbanUser(groupId, logEntry.userId);
                    break;
                case 'kick':
                    result = await electron.instance.kickUser(groupId, logEntry.userId);
                    break;
                case 'ban':
                    result = await electron.instance.banUser(groupId, logEntry.userId);
                    break;
            }
            
            if (result?.success) {
                if (shouldClose) {
                    onActionComplete();
                    onClose();
                }
            } else {
                console.error(`Action ${action} failed:`, result?.error);
                addNotification({
                    type: 'error',
                    title: 'Action Failed',
                    message: result?.error || 'Unknown error'
                });
            }
        } catch (e) {
            console.error(`Failed to perform action: ${action}`, e);
            addNotification({
                type: 'error',
                title: 'Action Failed',
                message: e instanceof Error ? e.message : 'Unknown error'
            });
        }
        setActionLoading(null);
    };

    if (!isOpen) return null;

    const actionType = logEntry?.action || 'BLOCKED';
    const userTags = user?.tags ? parseUserTags(user.tags) : [];
    const isAgeVerified = user?.ageVerificationStatus === '18+';
    const hasVRCPlus = user?.tags?.some((t: string) => t.includes('supporter'));
    const trustColor = user?.tags ? getTrustColor(user.tags) : '#6b7280';
    
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                >
                    <motion.div
                        key="modal-content"
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{ 
                                width: '100%', 
                                maxWidth: '520px', 
                                maxHeight: '85vh',
                                zIndex: 10001,
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <GlassPanel style={{ 
                                padding: '0', 
                                border: `1px solid ${trustColor}40`,
                                boxShadow: `0 0 40px ${trustColor}20`,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '100%'
                            }}>
                                {/* Header with Name & Close */}
                                <div style={{ 
                                    padding: '1rem 1.25rem', 
                                    background: 'rgba(0,0,0,0.3)',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexShrink: 0
                                }}>
                                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                                        {loading ? 'Loading...' : (user?.displayName || logEntry?.user || 'Unknown User')}
                                    </h2>
                                    <button onClick={onClose} style={{ 
                                        background: 'rgba(255,255,255,0.1)', 
                                        border: 'none', 
                                        color: 'rgba(255,255,255,0.7)', 
                                        cursor: 'pointer', 
                                        padding: '6px',
                                        borderRadius: '6px',
                                        display: 'flex'
                                    }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                </div>

                                {/* Scrollable Content */}
                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                    {/* Profile Section */}
                                    <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                            {/* Avatar */}
                                            <div style={{
                                                width: '80px', 
                                                height: '80px', 
                                                borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.1)',
                                                backgroundImage: user?.currentAvatarThumbnailImageUrl ? `url(${user.currentAvatarThumbnailImageUrl})` : 'none',
                                                backgroundSize: 'cover', 
                                                backgroundPosition: 'center',
                                                border: `2px solid ${trustColor}`,
                                                flexShrink: 0
                                            }} />
                                            
                                            {/* Name & Status */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 700, color: 'white' }}>
                                                    {user?.displayName || logEntry?.user || 'Unknown'}
                                                </h3>
                                                {user?.statusDescription && (
                                                    <div style={{ 
                                                        fontSize: '0.85rem', 
                                                        color: 'rgba(255,255,255,0.7)',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {user.statusDescription}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Tags Row */}
                                        {userTags.length > 0 && (
                                            <div style={{ 
                                                display: 'flex', 
                                                flexWrap: 'wrap', 
                                                gap: '6px', 
                                                marginBottom: '1rem' 
                                            }}>
                                                {userTags.map((tag, i) => (
                                                    <TagBadge key={i} label={tag.label} color={tag.color} />
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Badges Row (18+, VRC+, etc) */}
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {isAgeVerified && (
                                                <span style={{
                                                    background: '#ef4444',
                                                    color: 'white',
                                                    padding: '4px 10px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    18+
                                                </span>
                                            )}
                                            {hasVRCPlus && (
                                                <span style={{
                                                    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                                                    color: 'white',
                                                    padding: '4px 10px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    supporter
                                                </span>
                                            )}
                                            {user?.pronouns && (
                                                <span style={{
                                                    background: 'rgba(255,255,255,0.1)',
                                                    color: 'rgba(255,255,255,0.8)',
                                                    padding: '4px 10px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {user.pronouns}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bio Section */}
                                    {user?.bio && (
                                        <div style={{ 
                                            padding: '1rem 1.5rem', 
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            background: 'rgba(0,0,0,0.2)'
                                        }}>
                                            <div style={{ 
                                                fontSize: '0.7rem', 
                                                fontWeight: 'bold', 
                                                color: 'var(--color-text-dim)', 
                                                marginBottom: '8px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}>
                                                BIO
                                            </div>
                                            <div style={{ 
                                                fontSize: '0.9rem', 
                                                color: 'rgba(255,255,255,0.9)',
                                                lineHeight: 1.6,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word'
                                            }}>
                                                {user.bio}
                                            </div>
                                        </div>
                                    )}

                                    {/* AutoMod Action Info */}
                                    <div style={{ 
                                        padding: '1rem 1.5rem', 
                                        background: (actionType === 'BLOCKED' || actionType === 'FLAGGED') ? 'rgba(239, 68, 68, 0.1)' : actionType === 'ACCEPTED' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '8px',
                                            marginBottom: '8px'
                                        }}>
                                            <span style={{ 
                                                width: '10px', 
                                                height: '10px', 
                                                borderRadius: '50%', 
                                                background: (actionType === 'BLOCKED' || actionType === 'FLAGGED') ? '#f87171' : actionType === 'ACCEPTED' ? '#4ade80' : '#fbbf24'
                                            }} />
                                            <span style={{ 
                                                fontWeight: 'bold', 
                                                color: (actionType === 'BLOCKED' || actionType === 'FLAGGED') ? '#f87171' : actionType === 'ACCEPTED' ? '#4ade80' : '#fbbf24',
                                                fontSize: '0.85rem',
                                                textTransform: 'uppercase'
                                            }}>
                                                {actionType}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                                            <strong>Reason:</strong> {logEntry?.reason || 'No reason recorded'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                            {logEntry?.timestamp ? new Date(logEntry.timestamp).toLocaleString() : 'Unknown time'}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons - Fixed at bottom */}
                                <div style={{ 
                                    padding: '1rem 1.5rem', 
                                    background: 'rgba(0,0,0,0.3)',
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.5rem',
                                    flexShrink: 0
                                }}>
                                    <div style={{ 
                                        fontSize: '0.7rem', 
                                        fontWeight: 'bold', 
                                        color: 'var(--color-text-dim)', 
                                        marginBottom: '0.25rem', 
                                        textTransform: 'uppercase', 
                                        letterSpacing: '0.05em' 
                                    }}>
                                        Reversal Actions
                                    </div>

                                    {(actionType === 'BLOCKED' || actionType === 'REJECTED') && (
                                        <NeonButton 
                                            variant="secondary" // Green ish? NeonButton secondary is usually cyan actually.
                                            // Let's use custom class or style override if needed, or stick to provided variants.
                                            // Actually green is usually 'success' but NeonButton only has primary/secondary/danger
                                            onClick={() => handleAction('invite')}
                                            disabled={actionLoading !== null}
                                            glow={true}
                                            style={{
                                                borderColor: '#4ade80',
                                                color: '#4ade80',
                                                background: 'rgba(74, 222, 128, 0.1)',
                                                width: '100%'
                                            }}
                                        >
                                            {actionLoading === 'invite' ? 'Inviting...' : 'Invite to Group'}
                                        </NeonButton>
                                    )}

                                    {actionType === 'BANNED' && (
                                        <>
                                            <Button 
                                                variant="outline"
                                                onClick={() => handleAction('unban')}
                                                disabled={actionLoading !== null}
                                                className="w-full text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10"
                                            >
                                                {actionLoading === 'unban' ? 'Unbanning...' : 'Unban User'}
                                            </Button>
                                            
                                            <NeonButton 
                                                onClick={async () => { await handleAction('unban', false); await handleAction('invite', true); }}
                                                disabled={actionLoading !== null}
                                                style={{ width: '100%', borderColor: '#4ade80', color: '#4ade80' }}
                                            >
                                                Unban + Invite to Group
                                            </NeonButton>
                                        </>
                                    )}

                                    {(actionType === 'ACCEPTED' || actionType === 'FLAGGED') && (
                                        <>
                                            <Button 
                                                variant="outline"
                                                onClick={() => handleAction('kick')}
                                                disabled={actionLoading !== null}
                                                className="w-full text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/10"
                                            >
                                                {actionLoading === 'kick' ? 'Kicking...' : 'Kick from Group'}
                                            </Button>
                                            
                                            <NeonButton 
                                                variant="danger"
                                                onClick={() => handleAction('ban')}
                                                disabled={actionLoading !== null}
                                                className="w-full"
                                            >
                                                {actionLoading === 'ban' ? 'Banning...' : 'Ban from Group'}
                                            </NeonButton>
                                        </>
                                    )}
                                </div>
                            </GlassPanel>
                        </motion.div>
                    </motion.div>
                )}
        </AnimatePresence>,
        document.body
    );
};
