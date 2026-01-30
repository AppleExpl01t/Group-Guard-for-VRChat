import React from 'react';
import { Users, UserPlus, Gavel, Tag } from 'lucide-react';
import { NeonButton } from '../../../components/ui/NeonButton';
import { TrustRankBadge, AgeVerifiedBadge } from '../../../components/ui/UserBadges';
import type { LiveEntity } from '../../../stores/instanceMonitorStore';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import styles from '../LiveView.module.css';

interface EntityCardProps {
    entity: LiveEntity;
    onInvite: (id: string, name: string) => void;
    onKick: (id: string, name: string) => void;
    onBan: (id: string, name: string) => void;
    onAddFlag: (id: string, name: string) => void;
    readOnly?: boolean;
    // Selection Props
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    selectionMode?: boolean;
}

const EntityCardComponent: React.FC<EntityCardProps> = ({
    entity,
    onInvite,
    onKick,
    onBan,
    onAddFlag,
    readOnly,
    isSelected,
    onToggleSelect,
    selectionMode
}) => {
    const { openProfile } = useUserProfileStore();

    const [imgError, setImgError] = React.useState(false);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    // Auto-refresh relative time every 30s
    React.useEffect(() => {
        if (!readOnly) return;
        const interval = setInterval(() => forceUpdate(), 30000);
        return () => clearInterval(interval);
    }, [readOnly]);

    const handleCardClick = (e: React.MouseEvent) => {
        // If clicking action buttons, don't toggle select
        if ((e.target as HTMLElement).closest('button')) return;

        if (onToggleSelect) {
            onToggleSelect(entity.id);
        }
    };

    const formatRelativeTime = (timeValue: string | number) => {
        const ms = typeof timeValue === 'string' ? new Date(timeValue).getTime() : timeValue;
        const seconds = Math.floor((Date.now() - ms) / 1000);

        if (seconds < 5) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };



    return (
        <div
            className={`${styles.entityCard} ${isSelected ? styles.entityCardSelected : ''}`}
            onClick={handleCardClick}
            style={{
                borderColor: isSelected ? 'var(--color-primary)' : undefined,
                background: isSelected ? 'rgba(var(--primary-hue), 100%, 50%, 0.1)' : undefined,
                cursor: onToggleSelect ? 'pointer' : 'default'
            }}
        >
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
                        onClick={(e) => {
                            e.stopPropagation(); // Don't select when clicking name link? Maybe we do want selection.
                            // Actually, let's allow selection on row click, but name click opens profile?
                            // Default behavior is name click opens profile.
                            openProfile(entity.id);
                        }}
                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)', textUnderlineOffset: '4px' }}
                    >
                        {entity.displayName}
                    </div>
                    <div className={styles.entityMeta} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        {!readOnly ? (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{
                                    color: entity.isGroupMember ? 'var(--color-primary)' : '#fca5a5',
                                    fontWeight: 'bold',
                                    fontSize: '0.75rem'
                                }}>
                                    {entity.isGroupMember ? 'MEMBER' : 'NON-MEMBER'}
                                </span>
                                {entity.friendStatus === 'friend' && (
                                    <>
                                        <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>
                                        <span style={{ color: '#86efac', fontWeight: 'bold', fontSize: '0.75rem' }}>FRIEND</span>
                                        {entity.friendScore && entity.friendScore > 0 && (
                                            <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '4px' }}>
                                                ({entity.friendScore})
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            <span style={{ color: 'var(--color-text-dim)' }}>
                                {((entity as any).leftAt || entity.status === 'left' || entity.status === 'kicked')
                                    ? `Left ${formatRelativeTime((entity as any).leftAt || entity.lastUpdated)}`
                                    : 'Recently Detected'}
                            </span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrustRankBadge tags={undefined} fallbackRank={entity.rank} />
                            <AgeVerifiedBadge isVerified={entity.isAgeVerified} />
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.entityActions}>
                {/* Checkbox for visual selection feedback in addition to border */}
                {selectionMode && (
                    <div style={{
                        width: '20px', height: '20px',
                        borderRadius: '4px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        background: isSelected ? 'var(--color-primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginRight: '8px'
                    }}>
                        {isSelected && <div style={{ width: '10px', height: '10px', background: 'white' }} />}
                    </div>
                )}

                {/* Add Flag Button */}
                <NeonButton
                    size="sm"
                    variant="secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', opacity: 0.7 }}
                    onClick={(e) => { e.stopPropagation(); onAddFlag(entity.id, entity.displayName); }}
                    title="Add Player Flag"
                >
                    <Tag size={14} />
                </NeonButton>

                {!readOnly && !entity.isGroupMember && (
                    <NeonButton
                        size="sm"
                        variant="secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={(e) => { e.stopPropagation(); onInvite(entity.id, entity.displayName); }}
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
                    onClick={(e) => { e.stopPropagation(); onBan(entity.id, entity.displayName); }}
                    title="Ban Manager"
                >
                    <Gavel size={14} />
                </NeonButton>

                {!readOnly && (
                    <NeonButton
                        size="sm"
                        variant="danger"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={(e) => { e.stopPropagation(); onKick(entity.id, entity.displayName); }}
                        title="Kick from Instance"
                    >
                        <Gavel size={14} />
                    </NeonButton>
                )}
            </div>
        </div>
    );
};

export const EntityCard = React.memo(EntityCardComponent, (prev, next) => {
    // Check handlers reference equality
    if (prev.onInvite !== next.onInvite) return false;
    if (prev.onKick !== next.onKick) return false;
    if (prev.onBan !== next.onBan) return false;
    if (prev.onAddFlag !== next.onAddFlag) return false;
    if (prev.readOnly !== next.readOnly) return false;

    // Check selection props
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.selectionMode !== next.selectionMode) return false;
    // onToggleSelect function reference shouldn't change often but better safe
    if (prev.onToggleSelect !== next.onToggleSelect) return false;

    // Check entity properties depth-wise for visual changes
    const e1 = prev.entity;
    const e2 = next.entity;

    return (
        e1.id === e2.id &&
        e1.displayName === e2.displayName &&
        e1.status === e2.status &&
        e1.isGroupMember === e2.isGroupMember &&
        e1.rank === e2.rank &&
        e1.avatarUrl === e2.avatarUrl &&
        e1.friendStatus === e2.friendStatus &&
        e1.friendScore === e2.friendScore &&
        e1.isAgeVerified === e2.isAgeVerified
    );
});
