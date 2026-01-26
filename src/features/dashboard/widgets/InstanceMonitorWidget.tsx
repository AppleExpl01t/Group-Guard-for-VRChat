
import React from 'react';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { LiveBadge } from '../../../components/ui/LiveBadge';
import { useGroupStore } from '../../../stores/groupStore';
import { useInstanceMonitorStore } from '../../../stores/instanceMonitorStore';
import { useUserProfileStore } from '../../../stores/userProfileStore';

export const InstanceMonitorWidget: React.FC = () => {
    const { openProfile } = useUserProfileStore();
    const { currentWorldName, currentWorldId, currentLocation, currentGroupId, players } = useInstanceMonitorStore();
    const { instances, myGroups, selectedGroup: activeGroup } = useGroupStore();

    // PRIMARY DETECTION: Log watcher (IPC) tells us if we're in a group instance
    // This is the single source of truth from VRChat log parsing
    const isCurrentGroupFromLogs = !!(currentGroupId && activeGroup && currentGroupId === activeGroup.id);

    // Try to find matching instance from API for extra metadata (optional, may be stale)
    const apiInstance = currentLocation ? instances.find(inst => {
         if (inst.location === currentLocation) return true;
         const instFullId = inst.worldId && inst.instanceId ? `${inst.worldId}:${inst.instanceId}` : '';
         if (instFullId === currentLocation) return true;
         if (!currentLocation.includes(':')) return false;
         const [currWId, currIId] = currentLocation.split(':');
         const instWId = inst.worldId;
         const instIId = inst.instanceId || (inst.location ? inst.location.split(':')[1] : '');
         if (currWId !== instWId) return false;
         const currBase = currIId.split('~')[0];
         const instBase = instIId.split('~')[0];
         return currBase && instBase && currBase === instBase;
    }) : null;

    // Determine if we should show group instance mode:
    // 1. Log watcher says it's the selected group's instance (most reliable)
    // 2. OR API instances list has a match for the selected group
    const isCurrentGroupInstance = isCurrentGroupFromLogs || 
        (apiInstance && activeGroup && apiInstance.ownerId === activeGroup.id);

    // Build the instance object to display
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let groupInstance: any = null;
    
    if (isCurrentGroupInstance) {
        // Use API data if available and matches, otherwise create synthetic
        if (apiInstance && apiInstance.ownerId === activeGroup?.id) {
            groupInstance = apiInstance;
        } else if (activeGroup) {
            // Create synthetic instance from log data
            groupInstance = {
                location: currentLocation || '',
                worldId: currentWorldId || '',
                instanceId: currentWorldId && currentLocation ? currentLocation.replace(`${currentWorldId}:`, '') : '',
                ownerId: activeGroup.id,
                count: Object.keys(players).length,
                world: { name: currentWorldName || 'Unknown World' },
                group: activeGroup
            };
        }
    }

    // If no world ID, show waiting state
    if (!currentWorldId && !currentWorldName) {
        return (
            <GlassPanel style={{ height: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <div style={{ textAlign: 'center', color: 'var(--color-text-dim)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginBottom: '0.4rem' }}>Waiting for VRChat...</div>
                    <div style={{ fontSize: '0.8rem' }}>Join a world to see live data</div>
                </div>
            </GlassPanel>
        );
    }
    
    // If in VRChat but NOT in the selected group's instance, show Roaming mode
    if (!isCurrentGroupInstance) {
        return (
             <GlassPanel style={{ height: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <div style={{ textAlign: 'center', color: 'var(--color-text-dim)', maxWidth: '90%' }}>
                    <div style={{ 
                        width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-text-dim)', 
                        margin: '0 auto 0.75rem auto', boxShadow: '0 0 10px rgba(255,255,255,0.1)' 
                    }} />
                    <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                        Roaming Mode
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        You are in <strong>{currentWorldName}</strong>
                    </div>
                    <div style={{ fontSize: '0.7rem', marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.4rem' }}>
                        Join a <strong>{activeGroup?.name || 'Group'}</strong> instance to activate Command Center
                    </div>

                </div>

            </GlassPanel>
        );
    }

    // Determine display name: prioritize group instance data as it's cleaner
    const displayWorldName = groupInstance?.world?.name || currentWorldName || 'Unknown World';
    const playerCount = Object.keys(players).length;
    const playerList = Object.values(players).sort((a, b) => b.joinTime - a.joinTime);

    // Dynamic Style for different group instances (Warn if viewing data for non-active group?)
    // For now, if we match ANY group instance, we show it, but maybe highlight if it's not the selected one.

    return (
        <GlassPanel style={{ height: '100%', padding: '0.75rem', display: 'flex', flexDirection: 'column' }}>
            {/* Header / Badges Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '6px', flex: '0 0 auto' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-accent)', letterSpacing: '0.5px', fontWeight: 600 }}>CURRENT INSTANCE</span>
                <LiveBadge />
                <span style={{ 
                    fontSize: '0.55rem', 
                    background: isCurrentGroupInstance ? 'rgba(0, 255, 100, 0.1)' : 'rgba(255,255,255,0.1)',
                    border: isCurrentGroupInstance ? '1px solid var(--color-success)' : '1px solid var(--color-primary)',
                    color: isCurrentGroupInstance ? 'var(--color-success)' : 'var(--color-primary)', 
                    padding: '2px 6px', 
                    borderRadius: '10px', 
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: isCurrentGroupInstance ? '0 0 10px rgba(0,255,100, 0.2)' : 'none',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {groupInstance.group?.name || myGroups.find(g => g.id === groupInstance.ownerId)?.name || 'GROUP'} INSTANCE
                </span>
            </div>

            {/* Content Row: World Info + Player Count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', flex: '0 0 auto' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                     <div style={{ 
                         fontSize: '1rem', 
                         fontWeight: 'bold', 
                         color: 'white',
                         whiteSpace: 'nowrap',
                         overflow: 'hidden',
                         textOverflow: 'ellipsis',
                         lineHeight: 1.2
                     }} title={displayWorldName}>{displayWorldName}</div>
                     <div style={{ 
                         fontSize: '0.6rem', 
                         color: 'rgba(255,255,255,0.4)', 
                         fontFamily: 'monospace',
                         whiteSpace: 'nowrap',
                         overflow: 'hidden',
                         textOverflow: 'ellipsis'
                     }}>{currentWorldId}</div>
                </div>

                
                <div style={{ textAlign: 'right', flex: '0 0 auto', marginTop: '-4px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--color-primary)', lineHeight: 1 }}>{playerCount}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>PLAYERS</div>
                </div>
            </div>

             {/* Player List */}
             <div style={{ 
                 flex: 1, // Fill remaining space
                 overflowY: 'auto', 
                 background: 'rgba(0,0,0,0.2)', 
                 borderRadius: '6px', 
                 padding: '0.4rem',
                 display: 'flex',
                 flexDirection: 'column',
                 gap: '2px',
                 minHeight: 0 // Crucial for flex scrolling
             }}>
                {playerList.map(p => (
                    <div key={p.displayName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem' }}>
                        <span 
                            style={{ 
                                fontWeight: 500,
                                cursor: p.userId ? 'pointer' : 'default',
                                textDecoration: p.userId ? 'underline' : 'none',
                                textDecorationColor: 'rgba(255,255,255,0.3)',
                                textUnderlineOffset: '2px'
                            }}
                            onClick={() => p.userId && openProfile(p.userId)}
                            title={p.userId ? 'View Profile' : undefined}
                            onMouseEnter={(e) => { if(p.userId) e.currentTarget.style.color = 'var(--color-primary)'; }}
                            onMouseLeave={(e) => { if(p.userId) e.currentTarget.style.color = 'inherit'; }}
                        >
                            {p.displayName}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                             {new Date(p.joinTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                        </span>
                    </div>
                ))}
                {playerList.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: 'auto', marginBottom: 'auto' }}>
                        No players detected
                    </div>
                )}
            </div>

        </GlassPanel>
    );
};
