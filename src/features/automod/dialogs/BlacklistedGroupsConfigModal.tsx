/**
 * BlacklistedGroupsConfigModal
 * 
 * Configuration dialog for the Blacklisted Groups AutoMod rule.
 * Allows searching VRChat groups and adding them to a blacklist.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { NeonButton } from '../../../components/ui/NeonButton';
import { Search, X, Users, Plus, Loader2, Trash2 } from 'lucide-react';
import styles from './BlacklistedGroupsConfigModal.module.css';

interface BlacklistedGroup {
    id: string;
    name: string;
    shortCode?: string;
    discriminator?: string;
    iconUrl?: string;
    memberCount?: number;
}

interface BlacklistedGroupsConfig {
    groupIds: string[];
    groups: BlacklistedGroup[];
}

interface BlacklistedGroupsConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: BlacklistedGroupsConfig;
    onUpdate: (config: BlacklistedGroupsConfig) => void;
}

interface SearchResult {
    id: string;
    name: string;
    shortCode: string;
    discriminator: string;
    iconUrl?: string;
    memberCount: number;
    description?: string;
}

export const BlacklistedGroupsConfigModal: React.FC<BlacklistedGroupsConfigModalProps> = ({
    isOpen,
    onClose,
    config,
    onUpdate
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [blacklist, setBlacklist] = useState<BlacklistedGroup[]>(config.groups || []);

    // Sync with external config when modal opens
    useEffect(() => {
        if (isOpen) {
            setBlacklist(config.groups || []);
        }
    }, [isOpen, config]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        setSearchError(null);
        setSearchResults([]);

        try {
            const result = await window.electron.automod.searchGroups(searchQuery.trim());
            if (result.success && result.groups) {
                setSearchResults(result.groups as SearchResult[]);
                if (result.groups.length === 0) {
                    setSearchError('No groups found');
                }
            } else {
                setSearchError(result.error || 'Failed to search groups');
            }
        } catch (e) {
            setSearchError(String(e));
        } finally {
            setSearching(false);
        }
    };

    const addToBlacklist = (group: SearchResult) => {
        // Don't add duplicates
        if (blacklist.find(g => g.id === group.id)) return;

        const newEntry: BlacklistedGroup = {
            id: group.id,
            name: group.name,
            shortCode: group.shortCode,
            discriminator: group.discriminator,
            iconUrl: group.iconUrl,
            memberCount: group.memberCount
        };

        setBlacklist(prev => [...prev, newEntry]);
    };

    const removeFromBlacklist = (groupId: string) => {
        setBlacklist(prev => prev.filter(g => g.id !== groupId));
    };

    const isBlacklisted = (groupId: string) => {
        return blacklist.some(g => g.id === groupId);
    };

    const handleSave = () => {
        const newConfig: BlacklistedGroupsConfig = {
            groupIds: blacklist.map(g => g.id),
            groups: blacklist
        };
        onUpdate(newConfig);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Blacklisted Groups Configuration"
            width="700px"
            footer={
                <>
                    <NeonButton variant="ghost" onClick={onClose}>
                        Cancel
                    </NeonButton>
                    <NeonButton onClick={handleSave} glow>
                        Save Changes
                    </NeonButton>
                </>
            }
        >
            <div className={styles.container}>
                {/* Search Section */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <Search size={16} />
                        Search Groups
                    </h3>
                    <p className={styles.sectionDesc}>
                        Search VRChat groups by name or shortCode to add to the blacklist.
                    </p>

                    <div className={styles.searchRow}>
                        <input
                            type="text"
                            placeholder="Enter group name or shortCode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className={styles.searchInput}
                        />
                        <NeonButton onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                            {searching ? <Loader2 size={16} className={styles.spinner} /> : <Search size={16} />}
                            Search
                        </NeonButton>
                    </div>

                    {searchError && !searchResults.length && (
                        <div className={styles.errorMsg}>{searchError}</div>
                    )}

                    {searchResults.length > 0 && (
                        <div className={styles.searchResults}>
                            {searchResults.map((group) => (
                                <div key={group.id} className={styles.resultItem}>
                                    {group.iconUrl ? (
                                        <img src={group.iconUrl} alt={group.name} className={styles.groupIcon} />
                                    ) : (
                                        <div className={styles.groupIconPlaceholder}>
                                            <Users size={16} />
                                        </div>
                                    )}
                                    <div className={styles.groupInfo}>
                                        <div className={styles.groupName}>{group.name}</div>
                                        <div className={styles.groupMeta}>
                                            <code>{group.shortCode}.{group.discriminator}</code>
                                            <span>{group.memberCount?.toLocaleString() || 0} members</span>
                                        </div>
                                    </div>
                                    <button
                                        className={`${styles.actionBtn} ${isBlacklisted(group.id) ? styles.added : ''}`}
                                        onClick={() => addToBlacklist(group)}
                                        disabled={isBlacklisted(group.id)}
                                    >
                                        {isBlacklisted(group.id) ? '✓ Added' : <><Plus size={14} /> Blacklist</>}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Current Blacklist Section */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <X size={16} />
                        Blacklisted Groups ({blacklist.length})
                    </h3>
                    <p className={styles.sectionDesc}>
                        Users who are members of these groups will be blocked from joining.
                    </p>

                    {blacklist.length === 0 ? (
                        <div className={styles.emptyState}>
                            No groups blacklisted. Search above to add groups.
                        </div>
                    ) : (
                        <div className={styles.blacklist}>
                            {blacklist.map((group) => (
                                <div key={group.id} className={styles.blacklistItem}>
                                    {group.iconUrl ? (
                                        <img src={group.iconUrl} alt={group.name} className={styles.groupIcon} />
                                    ) : (
                                        <div className={styles.groupIconPlaceholder}>
                                            <Users size={16} />
                                        </div>
                                    )}
                                    <div className={styles.groupInfo}>
                                        <div className={styles.groupName}>{group.name}</div>
                                        <div className={styles.groupMeta}>
                                            <code>{group.shortCode}.{group.discriminator}</code>
                                            {group.memberCount && <span>{group.memberCount.toLocaleString()} members</span>}
                                        </div>
                                    </div>
                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => removeFromBlacklist(group.id)}
                                        title="Remove from blacklist"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
