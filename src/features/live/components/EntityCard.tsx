import React from 'react';
import { Users, UserPlus, Gavel, FileText } from 'lucide-react';
import { NeonButton } from '../../../components/ui/NeonButton';
import { AppShieldIcon } from '../../../components/ui/AppShieldIcon';
import type { LiveEntity } from '../../../stores/instanceMonitorStore';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import styles from '../LiveView.module.css';

interface EntityCardProps {
    entity: LiveEntity;
    onInvite: (id: string, name: string) => void;
    onKick: (id: string, name: string) => void;
    onBan: (id: string, name: string) => void;
    onReport: (id: string, name: string) => void;
    readOnly?: boolean;
}

const EntityCardComponent: React.FC<EntityCardProps> = ({
    entity,
    onInvite,
    onKick,
    onBan,
    onReport,
    readOnly
}) => {
    const { openProfile } = useUserProfileStore();

    const [imgError, setImgError] = React.useState(false);

    return (
        <div className={styles.entityCard}>
            <div className={styles.entityInfo}>
                <div className={`${styles.entityAvatar} ${!readOnly && entity.isGroupMember ? styles.entityAvatarMember : styles.entityAvatarDefault}`}>
                    {entity.avatarUrl && !imgError ? (
                        <img
                            src={entity.avatarUrl}
                            alt=""
                            className={styles.entityAvatarImg}
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <Users size={18} />
                    )}
                </div>
                <div>
                    <div
                        className={styles.entityName}
                        onClick={() => openProfile(entity.id)}
                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)', textUnderlineOffset: '4px' }}
                    >
                        {entity.displayName}
                    </div>
                    <div className={styles.entityMeta}>
                        {!readOnly ? (
                            <>
                                <span style={{
                                    color: entity.isGroupMember ? 'var(--color-primary)' : '#fca5a5',
                                    fontWeight: 'bold'
                                }}>
                                    {entity.isGroupMember ? 'MEMBER' : 'NON-MEMBER'}
                                </span>
                                <span>•</span>
                                <span>{entity.rank}</span>
                            </>
                        ) : (
                            <span>Detected User</span>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.entityActions}>
                {/* Report Button */}
                <NeonButton
                    size="sm"
                    variant="secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', opacity: 0.7 }}
                    onClick={() => onReport(entity.id, entity.displayName)}
                    title="Generate Report"
                >
                    <FileText size={14} />
                </NeonButton>

                {!readOnly && !entity.isGroupMember && (
                    <NeonButton
                        size="sm"
                        variant="secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => onInvite(entity.id, entity.displayName)}
                        title="Invite to Group"
                    >
                        <UserPlus size={14} />
                    </NeonButton>
                )}

                {/* Ban Manager Button */}
                <NeonButton
                    size="sm"
                    variant="danger"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', opacity: readOnly ? 0.8 : 1 }}
                    onClick={() => onBan(entity.id, entity.displayName)}
                    title="Ban Manager"
                >
                    <Gavel size={14} />
                </NeonButton>

                {!readOnly && (
                    <NeonButton
                        size="sm"
                        variant="danger"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => onKick(entity.id, entity.displayName)}
                        title="Kick from Instance"
                    >
                        <AppShieldIcon size={14} />
                    </NeonButton>
                )}
            </div>
        </div>
    );
};

export const EntityCard = React.memo(EntityCardComponent, (prev, next) => {
    // Check handlers reference equality (they should be memoized in parent)
    if (prev.onInvite !== next.onInvite) return false;
    if (prev.onKick !== next.onKick) return false;
    if (prev.onBan !== next.onBan) return false;
    if (prev.onReport !== next.onReport) return false;
    if (prev.readOnly !== next.readOnly) return false;

    // Check entity properties depth-wise for visual changes
    const e1 = prev.entity;
    const e2 = next.entity;

    return (
        e1.id === e2.id &&
        e1.displayName === e2.displayName &&
        e1.status === e2.status &&
        e1.isGroupMember === e2.isGroupMember &&
        e1.rank === e2.rank &&
        e1.avatarUrl === e2.avatarUrl
    );
});
