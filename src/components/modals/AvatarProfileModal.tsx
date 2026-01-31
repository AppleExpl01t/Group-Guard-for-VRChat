import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import styles from './AvatarProfileModal.module.css';
import type { VRCAvatar } from '../../types/electron';
import { Copy } from 'lucide-react';

interface AvatarProfileModalProps {
    avatarId: string | null;
    onClose: () => void;
    openUserProfile?: (userId: string) => void;
}

export const AvatarProfileModal: React.FC<AvatarProfileModalProps> = ({
    avatarId,
    onClose,
    openUserProfile
}) => {
    const [avatar, setAvatar] = useState<VRCAvatar | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        const loadAvatar = async (id: string) => {
            setLoading(true);
            setError(null);
            try {
                const result = await window.electron.avatars.get(id);
                if (isActive) {
                    if (result.success && result.data) {
                        setAvatar(result.data);
                    } else {
                        setError(result.error || 'Failed to fetch avatar');
                    }
                }
            } catch (err) {
                if (isActive) {
                    setError('An error occurred while fetching avatar details');
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        if (avatarId) {
            loadAvatar(avatarId);
        } else {
            setAvatar(null);
        }

        return () => {
            isActive = false;
        };
    }, [avatarId]);

    const handleCopyId = () => {
        if (avatar?.id) {
            navigator.clipboard.writeText(avatar.id);
        }
    };

    if (!avatarId) return null;

    return (
        <Modal
            isOpen={!!avatarId}
            onClose={onClose}
            title="Avatar Details"
            width="600px"
        >
            {loading ? (
                <div className={styles.loading}>
                    <span>Loading avatar details...</span>
                </div>
            ) : error ? (
                <div className={styles.container}>
                    <div style={{ color: '#ef4444', textAlign: 'center' }}>{error}</div>
                </div>
            ) : avatar ? (
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div className={styles.imageContainer}>
                            <img
                                src={avatar.imageUrl || avatar.thumbnailImageUrl}
                                alt={avatar.name}
                                className={styles.avatarImage}
                            />
                        </div>
                        <div className={styles.infoSection}>
                            <h2 className={styles.title}>{avatar.name}</h2>

                            <div className={styles.idRow}>
                                <span className={styles.idBadge}>{avatar.id}</span>
                                <button className={styles.copyBtn} onClick={handleCopyId} title="Copy ID">
                                    <Copy size={16} />
                                </button>
                            </div>

                            <div className={styles.metadataGrid}>
                                <div className={styles.label}>Author:</div>
                                <div className={styles.value}>
                                    {openUserProfile ? (
                                        <a
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (avatar.authorId) openUserProfile(avatar.authorId); }}
                                            className={styles.authorLink}
                                        >
                                            {avatar.authorName}
                                        </a>
                                    ) : (
                                        <span>{avatar.authorName}</span>
                                    )}
                                </div>

                                <div className={styles.label}>Status:</div>
                                <div className={styles.value}>{avatar.releaseStatus}</div>

                                {avatar.version && (
                                    <>
                                        <div className={styles.label}>Version:</div>
                                        <div className={styles.value}>{avatar.version}</div>
                                    </>
                                )}
                            </div>

                            {avatar.tags && avatar.tags.length > 0 && (
                                <div className={styles.tags}>
                                    {avatar.tags.map(tag => (
                                        <span key={tag} className={styles.tag}>{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {avatar.description && (
                        <div className={styles.description}>
                            {avatar.description}
                        </div>
                    )}

                    <div className={styles.actions}>
                        <button className={styles.actionBtn} onClick={() => window.electron.openExternal(`https://vrchat.com/home/avatar/${avatar.id}`)}>
                            View on VRChat.com
                        </button>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
};
