import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { useGroupStore } from '../../../stores/groupStore';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { GlassPanel } from '../../../components/ui/GlassPanel';

import type { GroupMember } from '../../../types/electron';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const MembersListDialog: React.FC<Props> = ({ isOpen, onClose }) => {
    const { members, selectedGroup, fetchGroupMembers, loadMoreMembers, isMembersLoading } = useGroupStore();
    const { openProfile } = useUserProfileStore();
    const [search, setSearch] = useState('');
    
    // Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<GroupMember[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Infinite Scroll Ref
    const observerTarget = React.useRef(null);

    useEffect(() => {
        if (isOpen && selectedGroup) {
            // Initial fetch if empty or just ensuring freshness
            if (members.length === 0) {
                fetchGroupMembers(selectedGroup.id);
            }
        }
    }, [isOpen, selectedGroup]); // eslint-disable-line react-hooks/exhaustive-deps

    // Search Logic
    const performSearch = React.useCallback(async (query: string) => {
        if (!selectedGroup || !query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        setSearchError(null);

        try {
            const result = await window.electron.searchGroupMembers(selectedGroup.id, query, 50);
            if (result.success && result.members) {
                 setSearchResults(result.members);
            } else {
                 setSearchError(result.error || 'Search failed');
            }
        } catch (err: unknown) {
             const error = err as { message?: string };
             setSearchError(error.message || 'Search failed');
        } finally {
             setIsSearching(false);
        }
    }, [selectedGroup]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        if (value.trim().length >= 2) {
            searchDebounceRef.current = setTimeout(() => {
                performSearch(value);
            }, 500);
        } else {
            setSearchResults([]);
        }
    };

    // Infinite Scroll Logic
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && !isMembersLoading && !search && selectedGroup) {
                    loadMoreMembers(selectedGroup.id);
                }
            },
            { threshold: 1.0 }
        );

        const currentTarget = observerTarget.current;

        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [observerTarget, isMembersLoading, search, selectedGroup, loadMoreMembers]);

    // Determine display list
    const isSearchActive = search.trim().length >= 2;
    const displayMembers = isSearchActive ? searchResults : members;

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
                    placeholder="Search members (server-side)..." 
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
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

            <div style={{ height: '60vh', overflowY: 'auto', paddingRight: '5px' }}>
                {isSearching ? (
                     <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Searching...</div>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                            {displayMembers.map((member, idx) => (
                                <GlassPanel 
                                    key={`${member.id}-${idx}`} // Use index fallback if IDs duplicate during dev
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
                        
                        {/* Loading / Sentinel */}
                        {!isSearchActive && (
                            <div ref={observerTarget} style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                                {isMembersLoading && <span>Loading more...</span>}
                            </div>
                        )}
                        
                        {searchError && <div style={{ color: 'red', textAlign: 'center', marginTop: '10px' }}>{searchError}</div>}
                        
                        {!isMembersLoading && !isSearching && displayMembers.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No members found.</div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};
