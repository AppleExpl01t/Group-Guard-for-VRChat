import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { NeonButton } from '../../../components/ui/NeonButton';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { Search, UserPlus, Users, Loader2, User } from 'lucide-react';
import { useGroupStore } from '../../../stores/groupStore';
import { useInstanceMonitorStore } from '../../../stores/instanceMonitorStore';
// @ts-expect-error lodash types are optional
import debounce from 'lodash/debounce';

interface EntitySearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (id: string, displayName: string, type: 'user' | 'group' | 'avatar') => void;
}

interface SearchResult {
    id: string;
    displayName: string;
    thumbnailUrl?: string;
    source: 'live' | 'member' | 'direct' | 'database';
    detail?: string;
}

export const EntitySearchModal: React.FC<EntitySearchModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const prevIsOpen = useRef(isOpen);

    const { selectedGroup } = useGroupStore();
    const { liveScanResults } = useInstanceMonitorStore();

    // Reset when modal opens (using ref to detect transition)
    useEffect(() => {
        if (isOpen && !prevIsOpen.current) {
            // Schedule state reset for next tick to avoid synchronous setState in effect
            requestAnimationFrame(() => {
                setQuery('');
                setResults([]);
            });
        }
        prevIsOpen.current = isOpen;
    }, [isOpen]);

    // Live Search Data (Memoized)
    const liveUsers = useMemo(() => {
        return liveScanResults.filter(u => u.status === 'active' || u.status === 'joining');
    }, [liveScanResults]);

    // Search Logic
    const performSearch = async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const lowerQuery = searchQuery.toLowerCase();
        const combinedResults: SearchResult[] = [];
        const seenIds = new Set<string>();

        // 1. Search Live Users (Instant)
        const matchedLive = liveUsers.filter(u => 
            u.displayName.toLowerCase().includes(lowerQuery) || 
            u.id.toLowerCase().includes(lowerQuery)
        );
        
        matchedLive.forEach(u => {
            seenIds.add(u.id);
            combinedResults.push({
                id: u.id,
                displayName: u.displayName,
                thumbnailUrl: u.avatarUrl,
                source: 'live',
                detail: `Live in Instance • ${u.rank}`
            });
        });

        // 2. Search Group Members (Async)
        if (selectedGroup) {
            try {
                // If query is short, we might skip API call to save rate limits, 
                // but for now let's search if length > 2
                if (searchQuery.length > 2) {
                    const res = await window.electron.searchGroupMembers(selectedGroup.id, searchQuery, 10);
                    if (res.success && res.members) {
                        res.members.forEach(m => {
                            // Avoid duplicates if user is both live and member
                            if (!seenIds.has(m.user.id)) {
                                seenIds.add(m.user.id);
                                combinedResults.push({
                                    id: m.user.id,
                                    displayName: m.user.displayName,
                                    thumbnailUrl: m.user.currentAvatarThumbnailImageUrl || m.user.userIcon,
                                    source: 'member',
                                    detail: `${selectedGroup.name} Member`
                                });
                            }
                        });
                    }
                }
            } catch (e) {
                console.error("Group member search failed", e);
            }
        }

        // 3. Search Scanned Users from Database
        if (searchQuery.length >= 2) {
            try {
                const scannedUsers = await window.electron.watchlist.searchScannedUsers(searchQuery);
                scannedUsers.forEach(u => {
                    if (!seenIds.has(u.id)) {
                        seenIds.add(u.id);
                        combinedResults.push({
                            id: u.id,
                            displayName: u.displayName,
                            thumbnailUrl: u.thumbnailUrl || undefined,
                            source: 'database',
                            detail: `Seen ${u.timesEncountered}x${u.rank ? ` • ${u.rank}` : ''}`
                        });
                    }
                });
            } catch (e) {
                console.error("Database user search failed", e);
            }
        }

        // 4. Check for Direct ID (e.g. usr_..., grp_...)
        if (searchQuery.startsWith('usr_') || searchQuery.startsWith('grp_') || searchQuery.startsWith('avtr_')) {
            // If strictly an ID and not found yet
            if (!seenIds.has(searchQuery)) {
                combinedResults.unshift({
                    id: searchQuery,
                    displayName: searchQuery,
                    source: 'direct',
                    detail: 'Direct ID Entry'
                });
            }
        }

        setResults(combinedResults);
        setIsSearching(false);
    };

    // Debounce the search - use useCallback to memoize performSearch
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSearch = useMemo(() => debounce(performSearch, 500), []);

    // Handle query changes with debounced search
    const queryRef = useRef(query);
    queryRef.current = query;
    
    useEffect(() => {
        if (queryRef.current) {
            // Use callback to set searching state
            requestAnimationFrame(() => setIsSearching(true));
            debouncedSearch(queryRef.current);
        } else {
            requestAnimationFrame(() => {
                setResults([]);
                setIsSearching(false);
            });
        }
        return () => {
            debouncedSearch.cancel();
        };
    }, [query, debouncedSearch]);

    const handleSelect = (result: SearchResult) => {
        const type = result.id.startsWith('grp_') ? 'group' : result.id.startsWith('avtr_') ? 'avatar' : 'user';
        onAdd(result.id, result.displayName, type);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add to Watchlist"
            width="550px"
        >
            <div className="flex flex-col gap-4">
                <GlassPanel className="p-0 overflow-hidden flex items-center bg-white/5 border border-white/5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="pl-4 pr-3 text-[var(--color-text-dim)]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        <Search size={20} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search Live Users, Group Members, or Paste IDs (usr_...)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                        style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'white',
                            width: '100%',
                            height: '50px',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            padding: '0'
                        }}
                    />
                    {isSearching && (
                        <div className="pr-4 text-[var(--color-primary)] animate-spin">
                            <Loader2 size={18} />
                        </div>
                    )}
                </GlassPanel>

                <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto min-h-[100px] pr-1">
                    
                    {query && !isSearching && results.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-dim)] py-12 gap-3">
                             <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-red-400">
                                <Users size={32} />
                             </div>
                             <span className="text-sm">No matched users found.</span>
                             {query.length > 5 && (
                                 <button 
                                    className="mt-2 text-[var(--color-primary)] hover:underline text-xs bg-white/5 px-4 py-2 rounded-lg"
                                    onClick={() => onAdd(query, query, 'user')}
                                 >
                                     Force Add ID "{query}"
                                 </button>
                             )}
                        </div>
                    )}

                    {results.map((result) => (
                        <div 
                            key={result.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] transition-all cursor-pointer group"
                            onClick={() => handleSelect(result)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.1)] overflow-hidden flex items-center justify-center text-white/50 border border-white/10">
                                    {result.thumbnailUrl ? (
                                        <img src={result.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={20} />
                                    )}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <div className="font-bold text-sm text-white flex items-center gap-2">
                                        {result.displayName}
                                    </div>
                                    <div className="text-xs flex items-center gap-2">
                                         {result.source === 'live' && (
                                            <span className="text-green-400 font-bold flex items-center gap-1 tracking-wider text-[0.65rem]">
                                                ● LIVE
                                            </span>
                                        )}
                                        {result.source === 'member' && (
                                            <span className="text-blue-400 font-bold flex items-center gap-1 tracking-wider text-[0.65rem]">
                                                ● MEMBER
                                            </span>
                                        )}
                                        {result.source === 'database' && (
                                            <span className="text-purple-400 font-bold flex items-center gap-1 tracking-wider text-[0.65rem]">
                                                ● SEEN
                                            </span>
                                        )}
                                        <span className="text-[var(--color-text-dim)]">•</span> 
                                        <span className="text-[var(--color-text-dim)]">{result.detail}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <NeonButton size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <UserPlus size={14} className="mr-1.5" />
                                Add
                            </NeonButton>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};
