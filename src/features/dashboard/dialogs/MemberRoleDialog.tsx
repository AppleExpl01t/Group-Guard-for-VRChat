
import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { NeonButton } from '../../../components/ui/NeonButton';
import type { GroupMember } from '../../../types/electron';

interface MemberRoleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    member: GroupMember | null;
    groupId: string;
    onUpdate: () => void; // Trigger refresh of parent list
}

interface GroupRole {
    id: string;
    name: string;
    description?: string;
    isSelfAssignable?: boolean;
    permissions?: string[];
}

interface UserFullDetails {
    id: string;
    displayName: string;
    bio?: string;
    userIcon?: string;
    currentAvatarThumbnailImageUrl?: string;
}

export const MemberRoleDialog: React.FC<MemberRoleDialogProps> = ({ isOpen, onClose, member, groupId, onUpdate }) => {
    const [allRoles, setAllRoles] = useState<GroupRole[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [userDetails, setUserDetails] = useState<UserFullDetails | null>(null);
    const [processingRole, setProcessingRole] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Current member's roles (local state to allow optimistic updates or re-fetches)
    const [memberRoleIds, setMemberRoleIds] = useState<string[]>([]);

    useEffect(() => {
        // Defined inside but functions need to be stable or in useEffect
        // Best approach: wrap them in useCallback or ignore deps if we trust them 
        // But to pass lint:
        loadRoles();
        if (member) {
            setMemberRoleIds(member.roleIds || []);
            loadUserDetails(member.userId);
        } else {
            setUserDetails(null);
            setMemberRoleIds([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, groupId, member]);

    const loadRoles = async () => {
        setIsLoading(true);
        try {
            const result = await window.electron.getGroupRoles(groupId);
            if (result.success && result.roles) {
                // Sort roles: assume standard roles might not have order index, but we can sort by name or permissions
                // VRChat doesn't give rank order easily. Just alphabetical for now?
                setAllRoles(result.roles as GroupRole[]);
            } else {
                setError("Failed to load group roles.");
            }
        } catch {
            setError("Error loading roles.");
        } finally {
            setIsLoading(false);
        }
    };

    const loadUserDetails = async (userId: string) => {
        // Optimistically set what we have
        if (member?.user) {
            setUserDetails(prev => ({
                id: userId,
                displayName: member.user.displayName,
                userIcon: member.user.userIcon,
                currentAvatarThumbnailImageUrl: member.user.currentAvatarThumbnailImageUrl,
                ...prev
            }));
        }

        // Fetch full profile for Bio
        try {
            const result = await window.electron.getUser(userId);
            if (result.success && result.user) {
                setUserDetails(result.user);
            }
        } catch {
            // ignore
        }
    };

    const handleAddRole = async (roleId: string) => {
        if (!member) return;
        setProcessingRole(roleId);
        try {
            const result = await window.electron.addMemberRole(groupId, member.userId, roleId);
            if (result.success) {
                setMemberRoleIds(prev => [...prev, roleId]);
                onUpdate(); // Refresh parent just in case
            }
        } catch {
            // fail silently or show toast
        } finally {
            setProcessingRole(null);
        }
    };

    const handleRemoveRole = async (roleId: string) => {
        if (!member) return;
        setProcessingRole(roleId);
        try {
            const result = await window.electron.removeMemberRole(groupId, member.userId, roleId);
            if (result.success) {
                setMemberRoleIds(prev => prev.filter(id => id !== roleId));
                onUpdate();
            }
        } catch {
            // fail
        } finally {
            setProcessingRole(null);
        }
    };

    const assignedRoles = allRoles.filter(r => memberRoleIds.includes(r.id));
    const availableRoles = allRoles.filter(r => !memberRoleIds.includes(r.id));

    if (!member) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Roles" width="550px">
            <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
                
                {/* User Header */}
                <div style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', alignItems: 'flex-start' }}>
                    <img 
                        src={userDetails?.userIcon || userDetails?.currentAvatarThumbnailImageUrl || undefined} 
                        style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-accent)' }}
                    />
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>{userDetails?.displayName || member.user.displayName}</h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontFamily: 'monospace', marginBottom: '0.4rem' }}>{member.userId}</div>
                        {userDetails?.bio && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: '1.3' }}>
                                "{userDetails.bio}"
                            </div>
                        )}
                    </div>
                </div>

                {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>{error}</div>}

                {/* Assigned Roles Section */}
                <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Assigned Roles</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {assignedRoles.map(role => (
                            <div key={role.id} style={{ 
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'rgba(0, 255, 150, 0.1)', border: '1px solid rgba(0, 255, 150, 0.3)',
                                borderRadius: '20px', padding: '4px 10px', fontSize: '0.8rem', color: '#4ade80'
                            }}>
                                <span>{role.name}</span>
                                <button 
                                    onClick={() => handleRemoveRole(role.id)}
                                    disabled={processingRole === role.id}
                                    style={{ 
                                        background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', 
                                        padding: '0 2px', display: 'flex', alignItems: 'center' 
                                    }}
                                    title="Remove Role"
                                >
                                    {processingRole === role.id ? '...' : '×'}
                                </button>
                            </div>
                        ))}
                         {assignedRoles.length === 0 && <span style={{ fontSize: '0.8rem', color: 'gray' }}>No custom roles assigned.</span>}
                    </div>
                </div>

                {/* Available Roles Section */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Available Roles</h4>
                    {isLoading ? (
                        <div style={{ fontSize: '0.8rem', color: 'gray' }}>Loading roles...</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                            {availableRoles.map(role => (
                                <button 
                                    key={role.id}
                                    onClick={() => handleAddRole(role.id)}
                                    disabled={processingRole === role.id}
                                    style={{ 
                                        textAlign: 'left', padding: '6px 10px',
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '6px', color: 'var(--color-text-secondary)', fontSize: '0.8rem',
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.name}</span>
                                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>+</span>
                                </button>
                            ))}
                             {availableRoles.length === 0 && !isLoading && <span style={{ fontSize: '0.8rem', color: 'gray' }}>No more roles available.</span>}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                     <NeonButton onClick={onClose}>Done</NeonButton>
                </div>
            </div>
        </Modal>
    );
};
