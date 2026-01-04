
import React from 'react';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { LiveBadge } from '../../../components/ui/LiveBadge';
import { useGroupStore } from '../../../stores/groupStore';
import { useInstanceMonitorStore } from '../../../stores/instanceMonitorStore';

export const InstanceMonitorWidget: React.FC = () => {
    const { currentWorldName, currentWorldId, currentLocation, players } = useInstanceMonitorStore();
    const { instances, myGroups } = useGroupStore();

    // Check if current location matches any active group instance
    const groupInstance = currentLocation ? instances.find(inst => {
         // Check both location field and manual ID construction
         if (inst.location === currentLocation) return true;
         if (inst.worldId && inst.instanceId && `${inst.worldId}:${inst.instanceId}` === currentLocation) return true;
         // Partial match for world ID
         if (inst.worldId === currentWorldId) return true;
         return false;
    }) : null;

    // Determine display name: prioritize group instance data as it's cleaner
    const displayWorldName = groupInstance?.world?.name || currentWorldName || 'Unknown World';

    const playerCount = Object.keys(players).length;
    const playerList = Object.values(players).sort((a, b) => b.joinTime - a.joinTime);

    // If no world ID, show status (Name might be missing in some log formats)
    if (!currentWorldId && !currentWorldName) {
        return (
            <GlassPanel style={{ height: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <div style={{ textAlign: 'center', color: 'var(--color-text-dim)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Waiting for VRChat...</div>
                    <div style={{ fontSize: '0.9rem' }}>Join a world to see live data</div>
                </div>
            </GlassPanel>
        );
    }

    return (
        <GlassPanel style={{ height: '100%', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            {/* Header / Badges Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px', flex: '0 0 auto' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.5px', fontWeight: 600 }}>CURRENT INSTANCE</span>
                <LiveBadge />
                {groupInstance && (
                    <span style={{ 
                        fontSize: '0.6rem', 
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid var(--color-primary)',
                        color: 'var(--color-primary)', 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        boxShadow: '0 0 10px rgba(var(--color-primary-rgb), 0.2)',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {groupInstance.group?.name || myGroups.find(g => g.id === groupInstance.ownerId)?.name || 'GROUP'} INSTANCE
                    </span>
                )}
            </div>

            {/* Content Row: World Info + Player Count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flex: '0 0 auto' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                     <div style={{ 
                         fontSize: '1.2rem', 
                         fontWeight: 'bold', 
                         color: 'white',
                         whiteSpace: 'nowrap',
                         overflow: 'hidden',
                         textOverflow: 'ellipsis',
                         lineHeight: 1.2
                     }} title={displayWorldName}>{displayWorldName}</div>
                     <div style={{ 
                         fontSize: '0.7rem', 
                         color: 'rgba(255,255,255,0.4)', 
                         fontFamily: 'monospace',
                         whiteSpace: 'nowrap',
                         overflow: 'hidden',
                         textOverflow: 'ellipsis'
                     }}>{currentWorldId}</div>
                </div>
                <div style={{ textAlign: 'right', flex: '0 0 auto', marginTop: '-4px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', lineHeight: 1 }}>{playerCount}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>PLAYERS</div>
                </div>
            </div>

             {/* Player List */}
             <div style={{ 
                 flex: 1, // Fill remaining space
                 overflowY: 'auto', 
                 background: 'rgba(0,0,0,0.2)', 
                 borderRadius: '8px', 
                 padding: '0.5rem',
                 display: 'flex',
                 flexDirection: 'column',
                 gap: '2px',
                 minHeight: 0 // Crucial for flex scrolling
             }}>
                {playerList.map(p => (
                    <div key={p.displayName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 500 }}>{p.displayName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                             {new Date(p.joinTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                        </span>
                    </div>
                ))}
                {playerList.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', marginTop: 'auto', marginBottom: 'auto' }}>
                        No players detected
                    </div>
                )}
            </div>
        </GlassPanel>
    );
};
