/**
 * UserProfileDialog
 * 
 * A comprehensive user profile dialog that displays all available user data
 * using the UserProfileService's complete data fetch.
 * Controlled by userProfileStore for global access.
 */

import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { User, Shield, Globe, Users, Clock, BadgeCheck, Crown, Copy, Check, Loader2 } from 'lucide-react';
import styles from './UserProfileDialog.module.css';

// Types matching backend
interface EnrichedUserProfile {
    id: string;
    displayName: string;
    bio: string;
    bioLinks: string[];
    pronouns: string;
    userIcon: string;
    profilePicOverride: string;
    currentAvatarThumbnailImageUrl: string;
    tags: string[];
    developerType: string;
    ageVerificationStatus: string;
    ageVerified: boolean;
    badges: { badgeId: string; badgeName: string; badgeDescription: string; badgeImageUrl: string; showcased: boolean }[];
    status: string;
    statusDescription: string;
    state: string;
    location: string;
    platform: string;
    last_platform: string;
    last_login: string;
    last_activity: string;
    isFriend: boolean;
    date_joined: string;
    $trustLevel: string;
    $isVRCPlus: boolean;
    $isModerator: boolean;
    $isTroll: boolean;
    $isProbableTroll: boolean;
    $languages: { key: string; value: string }[];
}

interface MutualCounts {
    friends: number;
    groups: number;
}

interface UserGroup {
    id: string;
    groupId: string;
    name: string;
    shortCode: string;
    discriminator: string;
    iconUrl?: string;
    memberCount: number;
    isRepresenting: boolean;
    mutualGroup: boolean;
}

interface FullUserProfileData {
    profile: EnrichedUserProfile;
    mutualCounts?: MutualCounts;
    mutualFriends?: { id: string; displayName: string }[];
    mutualGroups?: { id: string; name: string }[];
    userGroups?: UserGroup[];
}

export const UserProfileDialog: React.FC = () => {
    const { isOpen, userId, closeProfile } = useUserProfileStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profileData, setProfileData] = useState<FullUserProfileData | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            setError(null);
            setProfileData(null);

            window.electron.userProfile.getCompleteData(userId)
                .then(res => {
                    if (res.success && res.data) {
                        setProfileData(res.data as FullUserProfileData);
                    } else {
                        setError(res.error || 'Failed to load user profile');
                    }
                })
                .catch(err => setError(String(err)))
                .finally(() => setLoading(false));
        }
    }, [isOpen, userId]);

    const handleCopy = async (text: string, fieldName: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const getTrustColor = (trustLevel: string) => {
        const colors: Record<string, string> = {
            'Visitor': '#cccccc',
            'User': '#1778ff',
            'Known': '#2bcf5c',
            'Trusted': '#ff7b42',
            'Veteran': '#8b2cdb',
            'Legend': '#ffd700',
            'Unknown': '#666666'
        };
        return colors[trustLevel] || '#666666';
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        });
    };

    if (!isOpen) return null;

    const profile = profileData?.profile;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={closeProfile} 
            title={profile?.displayName || 'User Profile'}
            width="900px"
        >
            {loading ? (
                <div className={styles.loadingState}>
                    <Loader2 size={32} className={styles.spinner} />
                    <span>Loading profile...</span>
                </div>
            ) : error ? (
                <div className={styles.errorState}>
                    {error}
                </div>
            ) : profile ? (
                <div className={styles.dialogContent}>
                    {/* Profile Grid */}
                    <div className={styles.profileGrid}>
                        {/* Identity Card */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <User size={16} />
                                Identity
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.profileHeader}>
                                    <img 
                                        src={profile.profilePicOverride || profile.currentAvatarThumbnailImageUrl || profile.userIcon} 
                                        alt={profile.displayName}
                                        className={styles.avatar}
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://assets.vrchat.com/www/images/default-avatar.png'; }}
                                    />
                                    <div className={styles.profileInfo}>
                                        <h3 className={styles.displayName}>{profile.displayName}</h3>
                                        <div className={styles.idRow}>
                                            <code className={styles.userId}>{profile.id}</code>
                                            <button 
                                                className={styles.copyBtn}
                                                onClick={() => handleCopy(profile.id, 'id')}
                                            >
                                                {copiedField === 'id' ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                        {profile.pronouns && (
                                            <span className={styles.pronouns}>{profile.pronouns}</span>
                                        )}
                                    </div>
                                </div>

                                {profile.bio && (
                                    <div className={styles.bioSection}>
                                        <label>Bio</label>
                                        <p className={styles.bio}>{profile.bio}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Trust & Verification Card */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Shield size={16} />
                                Trust & Verification
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.trustBadge} style={{ borderColor: getTrustColor(profile.$trustLevel) }}>
                                    <span style={{ color: getTrustColor(profile.$trustLevel) }}>
                                        {profile.$trustLevel}
                                    </span>
                                </div>

                                <div className={styles.fieldGrid}>
                                    <div className={styles.field}>
                                        <label>Age Verification</label>
                                        <span className={profile.ageVerificationStatus === '18+' ? styles.verified : ''}>
                                            {profile.ageVerificationStatus || 'None'}
                                        </span>
                                    </div>
                                    <div className={styles.field}>
                                        <label>VRC+</label>
                                        <span className={profile.$isVRCPlus ? styles.vrcPlus : ''}>
                                            {profile.$isVRCPlus ? '★ Supporter' : 'No'}
                                        </span>
                                    </div>
                                    <div className={styles.field}>
                                        <label>Troll Flag</label>
                                        <span className={profile.$isTroll ? styles.warning : ''}>
                                            {profile.$isTroll ? '⚠ Yes' : 'No'}
                                        </span>
                                    </div>
                                    <div className={styles.field}>
                                        <label>Friend</label>
                                        <span>{profile.isFriend ? '✓ Yes' : 'No'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Presence Card */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Globe size={16} />
                                Presence
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.statusRow}>
                                    <span className={`${styles.statusDot} ${styles[profile.status] || ''}`} />
                                    <span className={styles.statusText}>
                                        {profile.status} {profile.statusDescription && `— ${profile.statusDescription}`}
                                    </span>
                                </div>

                                <div className={styles.fieldGrid}>
                                    <div className={styles.field}>
                                        <label>State</label>
                                        <span>{profile.state || 'Unknown'}</span>
                                    </div>
                                    <div className={styles.field}>
                                        <label>Platform</label>
                                        <span>{profile.platform || profile.last_platform || 'Unknown'}</span>
                                    </div>
                                </div>

                                {profile.$languages && profile.$languages.length > 0 && (
                                    <div className={styles.languagesSection}>
                                        <label>Languages</label>
                                        <div className={styles.languages}>
                                            {profile.$languages.map((lang) => (
                                                <span key={lang.key} className={styles.language}>
                                                    {lang.value}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Account Info Card */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Clock size={16} />
                                Account
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.field}>
                                        <label>Joined</label>
                                        <span>{formatDate(profile.date_joined)}</span>
                                    </div>
                                    <div className={styles.field}>
                                        <label>Last Login</label>
                                        <span>{formatDate(profile.last_login)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mutuals Card */}
                        {profileData.mutualCounts && (
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <Users size={16} />
                                    Mutuals
                                </div>
                                <div className={styles.cardContent}>
                                    <div className={styles.mutualStats}>
                                        <div className={styles.mutualStat}>
                                            <span className={styles.mutualCount}>{profileData.mutualCounts.friends}</span>
                                            <span className={styles.mutualLabel}>Friends</span>
                                        </div>
                                        <div className={styles.mutualStat}>
                                            <span className={styles.mutualCount}>{profileData.mutualCounts.groups}</span>
                                            <span className={styles.mutualLabel}>Groups</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tags Card */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <BadgeCheck size={16} />
                                Tags ({profile.tags?.length || 0})
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.tagsContainer}>
                                    {profile.tags?.slice(0, 15).map((tag) => (
                                        <span key={tag} className={styles.tag}>{tag}</span>
                                    ))}
                                    {(profile.tags?.length || 0) > 15 && (
                                        <span className={styles.tagMore}>+{profile.tags!.length - 15} more</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* User Groups (full width) */}
                    {profileData.userGroups && profileData.userGroups.length > 0 && (
                        <div className={styles.groupsSection}>
                            <div className={styles.cardHeader}>
                                <Crown size={16} />
                                Groups ({profileData.userGroups.length})
                            </div>
                            <div className={styles.groupsList}>
                                {profileData.userGroups.map((group) => (
                                    <div key={group.id} className={styles.groupItem}>
                                        {group.iconUrl ? (
                                            <img 
                                                src={group.iconUrl} 
                                                alt={group.name} 
                                                className={styles.groupIcon}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className={styles.groupIconPlaceholder}>
                                                <Users size={14} />
                                            </div>
                                        )}
                                        <div className={styles.groupInfo}>
                                            <div className={styles.groupNameRow}>
                                                <span className={styles.groupName}>{group.name}</span>
                                                {group.isRepresenting && (
                                                    <span className={styles.representingBadge}>★ Rep</span>
                                                )}
                                                {group.mutualGroup && (
                                                    <span className={styles.mutualBadge}>Mutual</span>
                                                )}
                                            </div>
                                            <div className={styles.groupMeta}>
                                                <code>{group.shortCode}.{group.discriminator}</code>
                                                <span>{group.memberCount.toLocaleString()} members</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </Modal>
    );
};
