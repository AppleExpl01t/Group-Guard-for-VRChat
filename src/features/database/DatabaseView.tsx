import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { useGroupStore } from '../../stores/groupStore';
import { NeonButton } from '../../components/ui/NeonButton';
import { Modal } from '../../components/ui/Modal';

interface Session {
    sessionId: string;
    worldId: string;
    instanceId: string;
    location: string;
    groupId: string | null;
    startTime: string;
    worldName: string | null;
    filename: string;
}

interface InstanceEvent {
    type: string;
    timestamp: string;
    actorDisplayName: string;
    actorUserId?: string;
    details?: unknown;
}

export const DatabaseView: React.FC = () => {
    const { selectedGroup } = useGroupStore();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Selection state
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [sessionEvents, setSessionEvents] = useState<InstanceEvent[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);
    
    // Filtering state
    const [selectedActor, setSelectedActor] = useState<string | null>(null);

    // Modal state
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

    const loadSessions = useCallback(async () => {
        setIsLoading(true);
        try {
            const groupId = selectedGroup?.id;
            const data = await window.electron.database.getSessions(groupId);
            setSessions(data);
            setSelectedSession(null);
            setSessionEvents([]);
            setSelectedActor(null);
        } catch (error) {
            console.error("Failed to load sessions", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedGroup]);

    // Initial Load
    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    // Fetch missing world names
    useEffect(() => {
        const fetchMissingNames = async () => {
             const updates = await Promise.all(sessions.map(async (s) => {
                 if (!s.worldName || s.worldName === 'Unknown World') {
                     // Extract World ID from location if worldId is missing or oddly formatted
                     // typical worldId: wrld_...
                     const wId = s.worldId || s.location.split(':')[0];
                     if (wId && wId.startsWith('wrld_')) {
                         try {
                             const details = await window.electron.getWorld(wId);
                             if (details.success && details.world?.name) {
                                  return { sessionId: s.sessionId, name: details.world.name };
                             }
                         } catch (e) {
                             console.error("Failed to fetch world name for", wId, e);
                         }
                     }
                 }
                 return null;
             }));

             const validUpdates = updates.filter(u => u !== null) as {sessionId: string, name: string}[];
             if (validUpdates.length > 0) {
                 setSessions(prev => prev.map(s => {
                     const update = validUpdates.find(u => u.sessionId === s.sessionId);
                     return update ? { ...s, worldName: update.name } : s;
                 }));
             }
        };
        
        if (sessions.length > 0) {
            fetchMissingNames();
        }
    }, [sessions]); // Run once when sessions list changes length (initial load)

    const handleSelectSession = async (session: Session) => {
        setSelectedSession(session);
        setIsLoadingEvents(true);
        setSelectedActor(null);
        try {
            const events = await window.electron.database.getSessionEvents(session.filename);
            setSessionEvents(events || []);
        } catch (error) {
            console.error("Failed to load events", error);
        } finally {
            setIsLoadingEvents(false);
        }
    };

    // Derived stats
    const eventsByActor = useMemo(() => {
        const counts: Record<string, number> = {};
        sessionEvents.forEach(e => {
            const name = e.actorDisplayName || 'Unknown';
            counts[name] = (counts[name] || 0) + 1;
        });
        return Object.entries(counts).sort((a,b) => b[1] - a[1]);
    }, [sessionEvents]);

    // Filter events
    const filteredEvents = useMemo(() => {
        if (!selectedActor) return sessionEvents;
        return sessionEvents.filter(e => e.actorDisplayName === selectedActor);
    }, [sessionEvents, selectedActor]);

    const handleClearDatabase = () => {
        setIsClearConfirmOpen(true);
    };

    const confirmClear = async () => {
        const success = await window.electron.database.clearSessions();
        if (success) {
            loadSessions();
        }
        setIsClearConfirmOpen(false);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '1.5rem', height: '100%', paddingBottom: '100px' }}>
            
            {/* Left Column: Session List */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 className="text-gradient">Instance Database</h2>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                            {selectedGroup ? `Viewing logs for ${selectedGroup.name}` : 'Viewing all local logs'}
                        </div>
                    </div>
                    <NeonButton size="sm" variant="danger" onClick={handleClearDatabase} style={{ fontSize: '0.7rem' }}>
                        Clear DB
                    </NeonButton>
                </div>

                <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>Sessions ({sessions.length})</span>
                        <NeonButton size="sm" variant="ghost" onClick={loadSessions} disabled={isLoading}>
                            {isLoading ? '...' : '⟳'}
                        </NeonButton>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {sessions.length === 0 && !isLoading && (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                                No logs found for this group.
                            </div>
                        )}
                        {sessions.map(session => (
                            <div 
                                key={session.sessionId}
                                onClick={() => handleSelectSession(session)}
                                style={{
                                    padding: '1rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    background: selectedSession?.sessionId === session.sessionId ? 'rgba(var(--color-primary-rgb), 0.1)' : 'transparent',
                                    borderLeft: selectedSession?.sessionId === session.sessionId ? '3px solid var(--color-primary)' : '3px solid transparent',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
                                    {session.worldName || 'Unknown World'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{new Date(session.startTime).toLocaleString()}</span>
                                    {session.groupId && <span style={{ color: 'var(--color-accent)' }}>GRP</span>}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {session.instanceId}
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassPanel>
            </div>

            {/* Right Column: Session Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                 {!selectedSession ? (
                     <GlassPanel style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                         <div style={{ fontSize: '3rem', opacity: 0.2 }}>📂</div>
                         <div style={{ marginTop: '1rem', color: 'var(--color-text-dim)' }}>Select a session to view details</div>
                     </GlassPanel>
                 ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                         {/* Session Metadata Card */}
                         <GlassPanel>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                 <div>
                                     <h3 style={{ margin: 0 }}>{selectedSession.worldName || selectedSession.worldId}</h3>
                                     <div style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                         {new Date(selectedSession.startTime).toLocaleString(undefined, {
                                             weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                         })}
                                     </div>
                                 </div>
                                 <div style={{ textAlign: 'right' }}>
                                     <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', lineHeight: 1 }}>{filteredEvents.length}</div>
                                     <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                         {selectedActor ? `Events by ${selectedActor}` : 'Total Events'}
                                     </div>
                                     {selectedActor && (
                                         <NeonButton 
                                            size="sm" 
                                            variant="ghost" 
                                            style={{ marginTop: '4px', fontSize: '0.7rem', padding: '2px 8px' }}
                                            onClick={() => setSelectedActor(null)}
                                         >
                                             Clear Filter
                                         </NeonButton>
                                     )}
                                 </div>
                             </div>
                         </GlassPanel>
                         
                         {/* Split View: Events Table and Stats */}
                         <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', minHeight: 0 }}>
                             
                             {/* Event List */}
                             <GlassPanel style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                                 <div style={{ padding: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', fontWeight: 600, fontSize: '0.9rem' }}>
                                     {selectedActor ? `Activity: ${selectedActor}` : 'Full Activity Log'}
                                 </div>
                                 <div style={{ flex: 1, overflowY: 'auto' }}>
                                     {isLoadingEvents ? (
                                         <div style={{ padding: '2rem', textAlign: 'center' }}>Loading events...</div>
                                     ) : (
                                         <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                             <thead style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-dim)', textAlign: 'left' }}>
                                                 <tr>
                                                     <th style={{ padding: '0.8rem' }}>Time</th>
                                                     <th style={{ padding: '0.8rem' }}>Type</th>
                                                     <th style={{ padding: '0.8rem' }}>User</th>
                                                     <th style={{ padding: '0.8rem' }}>Details</th>
                                                 </tr>
                                             </thead>
                                             <tbody>
                                                 {filteredEvents.length === 0 ? (
                                                     <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'gray' }}>No events found</td></tr>
                                                 ) : filteredEvents.map((event, idx) => (
                                                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                         <td style={{ padding: '0.6rem 0.8rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                                                             {new Date(event.timestamp).toLocaleTimeString([], {hour12: false})}
                                                         </td>
                                                         <td style={{ padding: '0.6rem 0.8rem' }}>
                                                             <EventBadge type={event.type} />
                                                         </td>
                                                         <td style={{ padding: '0.6rem 0.8rem', fontWeight: 500 }}>
                                                             {event.actorDisplayName}
                                                         </td>
                                                         <td style={{ padding: '0.6rem 0.8rem', color: 'rgba(255,255,255,0.6)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                             {JSON.stringify(event.details || '')}
                                                         </td>
                                                     </tr>
                                                 ))}
                                             </tbody>
                                         </table>
                                     )}
                                 </div>
                             </GlassPanel>

                             {/* Stats / Player List */}
                             <GlassPanel style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                                 <div style={{ padding: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', fontWeight: 600, fontSize: '0.9rem' }}>
                                     Participants
                                 </div>
                                 <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                                     {eventsByActor.map(([name, count]) => (
                                         <div 
                                             key={name} 
                                             onClick={() => setSelectedActor(name === selectedActor ? null : name)}
                                             style={{ 
                                                 display: 'flex', 
                                                 justifyContent: 'space-between', 
                                                 padding: '0.5rem', 
                                                 borderBottom: '1px solid rgba(255,255,255,0.02)',
                                                 cursor: 'pointer',
                                                 background: selectedActor === name ? 'rgba(var(--color-primary-rgb), 0.2)' : 'transparent',
                                                 borderRadius: '6px',
                                                 transition: 'background 0.2s'
                                             }}
                                         >
                                             <span style={{ fontSize: '0.9rem', color: selectedActor === name ? 'white' : 'inherit' }}>{name}</span>
                                             <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 6px' }}>{count}</span>
                                         </div>
                                     ))}
                                 </div>
                             </GlassPanel>

                         </div>
                     </div>
                 )}
            </div>

            {/* Clear Database Confirmation Modal */}
            <Modal
                isOpen={isClearConfirmOpen}
                onClose={() => setIsClearConfirmOpen(false)}
                title="Clear Database"
                width="400px"
                footer={
                    <>
                        <NeonButton 
                            variant="ghost" 
                            onClick={() => setIsClearConfirmOpen(false)}
                        >
                            Cancel
                        </NeonButton>
                        <NeonButton 
                            variant="danger" 
                            onClick={confirmClear}
                            glow
                        >
                            Yes, Clear Everything
                        </NeonButton>
                    </>
                }
            >
                <div style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                    Are you sure you want to clear the entire instance database?
                    <br /><br />
                    <span style={{ color: '#ef4444', fontWeight: 500 }}>
                        This cannot be undone.
                    </span>
                    <br />
                    All logged sessions and event history will be permanently deleted.
                    <br /><br />
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', fontStyle: 'italic' }}>
                        Note: If you are currently playing VRChat, you will need to rejoin the world to begin populating the new database.
                    </span>
                </div>
            </Modal>
        </div>
    );
};

const EventBadge = ({ type }: { type: string }) => {
    if (!type) return <span style={{ color: 'gray' }}>Unknown</span>;

    let color = 'gray';
    if (type === 'JOIN') color = '#22c55e';
    if (type === 'LEAVE') color = '#ef4444';
    if (type === 'AVATAR_CHANGE') color = '#3b82f6';
    if (type === 'WORLD_NAME_UPDATE') color = '#eab308';
    if (type === 'LOCATION_CHANGE') color = '#8b5cf6';

    return (
        <span style={{ 
            color: color, 
            background: `${color}20`, 
            padding: '2px 6px', 
            borderRadius: '4px', 
            fontSize: '0.7rem', 
            fontWeight: 700 
        }}>
            {type.replace('_', ' ')}
        </span>
    );
};
