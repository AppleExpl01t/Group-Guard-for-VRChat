import React, { useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { useGroupStore } from '../../../stores/groupStore';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { NeonButton } from '../../../components/ui/NeonButton';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const RequestsListDialog: React.FC<Props> = ({ isOpen, onClose }) => {
    const { requests, selectedGroup, fetchGroupRequests, isRequestsLoading, respondToRequest } = useGroupStore();
    const { openProfile } = useUserProfileStore();

    useEffect(() => {
        if (isOpen && selectedGroup) {
            fetchGroupRequests(selectedGroup.id);
        }
    }, [isOpen, selectedGroup, fetchGroupRequests]);

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Join Requests (${requests.length})`}
            width="600px"
        >
            <div style={{ height: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {isRequestsLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Loading requests...</div>
                ) : requests.length > 0 ? (
                    requests.map(req => (
                        <GlassPanel key={req.id} style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div 
                                style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
                                onClick={() => openProfile(req.user.id)}
                            >
                                <img 
                                    src={req.user.userIcon || req.user.currentAvatarThumbnailImageUrl} 
                                    alt={req.user.displayName}
                                    style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} 
                                />
                                <div>
                                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {req.user.displayName}
                                        {req.user.ageVerificationStatus === '18+' && (
                                            <span style={{ 
                                                background: '#fbbf24', 
                                                color: 'black', 
                                                fontSize: '0.6rem', 
                                                padding: '1px 4px', 
                                                borderRadius: '4px',
                                                fontWeight: '800'
                                            }}>18+</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                                        Requested: {new Date(req.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <NeonButton 
                                    variant="ghost" 
                                    style={{ color: '#ef4444' }}
                                    onClick={() => selectedGroup && respondToRequest(selectedGroup.id, req.user.id, 'deny')}
                                >Deny</NeonButton>
                                <NeonButton 
                                    variant="primary"
                                    onClick={() => selectedGroup && respondToRequest(selectedGroup.id, req.user.id, 'accept')}
                                >Accept</NeonButton>
                            </div>
                        </GlassPanel>
                    ))
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No pending requests.</div>
                )}
            </div>
        </Modal>
    );
};
