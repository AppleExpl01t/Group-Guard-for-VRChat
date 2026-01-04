import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { useGroupStore } from '../../../stores/groupStore';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { GlassPanel } from '../../../components/ui/GlassPanel';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const MembersListDialog: React.FC<Props> = ({ isOpen, onClose }) => {
    const { members, selectedGroup, fetchGroupMembers, isMembersLoading } = useGroupStore();
    const { openProfile } = useUserProfileStore();
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen && selectedGroup) {
            fetchGroupMembers(selectedGroup.id);
        }
    }, [isOpen, selectedGroup, fetchGroupMembers]);

    const filteredMembers = members.filter(m => 
        m.user.displayName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Members (${selectedGroup?.memberCount || 0})`}
            width="800px"
        >
            <div style={{ marginBottom: '1rem' }}>
                <input 
                    type="text" 
                    placeholder="Search members..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white'
                    }}
                />
            </div>

            <div style={{ height: '60vh', overflowY: 'auto' }}>
                {isMembersLoading && members.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Loading members...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {filteredMembers.map(member => (
                            <GlassPanel 
                                key={member.id} 
                                style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                                onClick={() => openProfile(member.userId)}
                            >
                                <img 
                                    src={member.user.userIcon || member.user.currentAvatarThumbnailImageUrl} 
                                    alt={member.user.displayName}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} 
                                />
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {member.user.displayName}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{member.membershipStatus}</div>
                                </div>
                            </GlassPanel>
                        ))}
                    </div>
                )}
                {!isMembersLoading && filteredMembers.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No members found.</div>
                )}
            </div>
        </Modal>
    );
};
