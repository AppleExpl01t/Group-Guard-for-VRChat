import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { useGroupStore } from '../../stores/groupStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { NeonButton } from '../../components/ui/NeonButton';
import { Modal } from '../../components/ui/Modal';
import { StatTile } from '../dashboard/components/StatTile';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Users, Calendar, Trash2, Megaphone, ChevronRight } from 'lucide-react';
import styles from '../dashboard/DashboardView.module.css';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
};

interface Session {
    sessionId: string;
    worldId: string;
    instanceId: string;
    location: string;
    groupId: string | null;
    startTime: string;
    worldName: string | null;
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
     const { openProfile } = useUserProfileStore();
     const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [sessionEvents, setSessionEvents] = useState<InstanceEvent[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);
    
    const [selectedActor, setSelectedActor] = useState<string | null>(null);

    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

    const [isRallyConfirmOpen, setIsRallyConfirmOpen] = useState(false);
    const [isRallying, setIsRallying] = useState(false);
    const [rallyResult, setRallyResult] = useState<{ invited?: number; failed?: number; total?: number; error?: string; errors?: string[] } | null>(null);
    const [rallyProgress, setRallyProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);

    useEffect(() => {
        const unsubscribe = window.electron.database.onRallyProgress((data) => {
            if (data.done) {
                setRallyProgress(null);
            } else {
                setRallyProgress({ sent: data.sent, failed: data.failed, total: data.total });
            }
        });
        return () => unsubscribe();
    }, []);

    const loadSessions = useCallback(async () => {
        setIsLoading(true);
        try {
            const groupId = selectedGroup?.id;
            const data = await window.electron.database.getSessions(groupId);
            setSessions(data as Session[]);
            setSelectedSession(null);
            setSessionEvents([]);
            setSelectedActor(null);
        } catch (error) {
            console.error("Failed to load sessions", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedGroup]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);



    const handleSelectSession = async (session: Session) => {
        setSelectedSession(session);
        setIsLoadingEvents(true);
        setSelectedActor(null);
        
        // Fetch world name on-demand if missing
        if (!session.worldName || session.worldName === 'Unknown World') {
            const wId = session.worldId || session.location.split(':')[0];
            if (wId && wId.startsWith('wrld_')) {
                try {
                    const details = await window.electron.getWorld(wId);
                    if (details.success && details.world?.name) {
                        const worldName = details.world.name;
                        // Update local state
                        setSessions(prev => prev.map(s => 
                            s.sessionId === session.sessionId ? { ...s, worldName } : s
                        ));
                        setSelectedSession({ ...session, worldName });
                        // Persist to database so we don't have to fetch again
                        await window.electron.database.updateSessionWorldName(session.sessionId, worldName);
                    }
                } catch (e) {
                    console.error("Failed to fetch world name", e);
                }
            }
        }
        
        try {
            const events = await window.electron.database.getSessionEvents(session.sessionId);
            setSessionEvents((events as InstanceEvent[]) || []);
        } catch (error) {
            console.error("Failed to load events", error);
        } finally {
            setIsLoadingEvents(false);
        }
    };

    const eventsByActor = useMemo(() => {
        const counts: Record<string, number> = {};
        sessionEvents.forEach(e => {
            const name = e.actorDisplayName || 'Unknown';
            counts[name] = (counts[name] || 0) + 1;
        });
        return Object.entries(counts).sort((a,b) => b[1] - a[1]);
    }, [sessionEvents]);

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

    const handleRallySession = () => {
        if (!selectedSession) return;
        setRallyResult(null);
        setIsRallyConfirmOpen(true);
    };

    const confirmRally = async () => {
        if (!selectedSession) return;
        
        setIsRallyConfirmOpen(false);
        setIsRallying(true);
        setRallyResult(null);
        
        try {
            const result = await window.electron.database.rallyFromSession(selectedSession.sessionId);
            setRallyResult(result);
        } catch (error: unknown) {
            const err = error as { message?: string };
            setRallyResult({ error: err.message || 'Unknown error' });
        } finally {
            setIsRallying(false);
        }
    };

    // Stats
    const totalEvents = sessions.reduce((acc, s) => acc + (s.sessionId ? 1 : 0), 0);
    const uniqueParticipants = new Set(sessionEvents.map(e => e.actorDisplayName)).size;

    return (
        <>
            <motion.div 
                className={styles.container}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', padding: '1rem', paddingBottom: 'var(--dock-height)' }}
            >
                {/* Header Section */}
                <GlassPanel className={styles.headerPanel} style={{ flexShrink: 0 }}>
                    <div className={styles.titleSection}>
                        <h1 className={`${styles.title} text-gradient`}>
                            Instance Database
                        </h1>
                        <div className={styles.subtitle}>
                            SESSION HISTORY & EVENTS
                        </div>
                    </div>

                    <div className={styles.statsGrid}>
                        <StatTile 
                            label="TOTAL SESSIONS"
                            value={sessions.length}
                            color="var(--color-primary)"
                        />
                        <StatTile 
                            label="EVENTS LOGGED"
                            value={selectedSession ? filteredEvents.length : totalEvents}
                            color="var(--color-info)"
                        />
                        <StatTile 
                            label="PARTICIPANTS"
                            value={selectedSession ? uniqueParticipants : '-'}
                            color="var(--color-accent)"
                        />
                        <StatTile 
                            label="GROUP SESSIONS"
                            value={sessions.filter(s => s.groupId).length}
                            color="var(--color-success)"
                        />
                    </div>
                </GlassPanel>

                {/* Main Content Split */}
                <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
                    
                    {/* Left: Session List */}
                    <GlassPanel style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={16} /> Sessions
                            </h3>
                            <NeonButton size="sm" variant="danger" onClick={handleClearDatabase} style={{ padding: '4px' }} title="Clear Database">
                                <Trash2 size={14} />
                            </NeonButton>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {sessions.length === 0 && !isLoading ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                    <Database size={32} style={{ opacity: 0.3 }} />
                                    <span>No sessions logged yet.</span>
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {sessions.map(session => (
                                        <motion.div 
                                            key={session.sessionId}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            onClick={() => handleSelectSession(session)}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                cursor: 'pointer',
                                                background: selectedSession?.sessionId === session.sessionId ? 'rgba(var(--color-primary-rgb), 0.1)' : 'transparent',
                                                borderLeft: selectedSession?.sessionId === session.sessionId ? '3px solid var(--color-primary)' : '3px solid transparent',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>
                                                    {session.worldName || 'Unknown World'}
                                                </div>
                                                <ChevronRight size={14} style={{ opacity: 0.3 }} />
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{new Date(session.startTime).toLocaleDateString()}</span>
                                                {session.groupId && <span style={{ color: 'var(--color-accent)' }}>GRP</span>}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </GlassPanel>

                    {/* Right: Session Detail */}
                    {!selectedSession ? (
                        <GlassPanel style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                            <Database size={48} style={{ opacity: 0.2 }} />
                            <div style={{ marginTop: '1rem', color: 'var(--color-text-dim)' }}>Select a session to view details</div>
                        </GlassPanel>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
                            {/* Session Info Card */}
                            <GlassPanel style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedSession.worldName || selectedSession.worldId}</h3>
                                        <div style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                            {new Date(selectedSession.startTime).toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {rallyResult && (
                                            <div style={{ 
                                                fontSize: '0.8rem',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                background: rallyResult.error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                                color: rallyResult.error ? '#ef4444' : '#22c55e'
                                            }}>
                                                {rallyResult.error ? `❌ ${rallyResult.error}` : `✓ ${rallyResult.invited} invited`}
                                            </div>
                                        )}
                                        <NeonButton 
                                            size="sm" 
                                            variant="primary"
                                            onClick={handleRallySession}
                                            disabled={isRallying}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Megaphone size={14} /> {isRallying ? 'Sending...' : 'Rally'}
                                        </NeonButton>
                                    </div>
                                </div>
                                
                                {isRallying && rallyProgress && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ 
                                                width: `${Math.round((rallyProgress.sent / rallyProgress.total) * 100)}%`, 
                                                height: '100%', 
                                                background: 'var(--color-primary)',
                                                borderRadius: '3px',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                        <span style={{ fontSize: '0.8rem', color: 'white', fontFamily: 'monospace' }}>
                                            {rallyProgress.sent}/{rallyProgress.total}
                                        </span>
                                    </div>
                                )}
                            </GlassPanel>
                            
                            {/* Events and Participants Split */}
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', minHeight: 0 }}>
                                
                                {/* Event List */}
                                <GlassPanel style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                            {selectedActor ? `Activity: ${selectedActor}` : 'Activity Log'}
                                        </span>
                                        {selectedActor && (
                                            <NeonButton size="sm" variant="ghost" onClick={() => setSelectedActor(null)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                                                Clear Filter
                                            </NeonButton>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        {isLoadingEvents ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading events...</div>
                                        ) : filteredEvents.length === 0 ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-dim)' }}>No events found</div>
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                <thead style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0 }}>
                                                    <tr>
                                                        <th style={{ padding: '0.6rem', textAlign: 'left', color: 'var(--color-text-dim)', fontWeight: 600 }}>Time</th>
                                                        <th style={{ padding: '0.6rem', textAlign: 'left', color: 'var(--color-text-dim)', fontWeight: 600 }}>Type</th>
                                                        <th style={{ padding: '0.6rem', textAlign: 'left', color: 'var(--color-text-dim)', fontWeight: 600 }}>User</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredEvents.map((event, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                            <td style={{ padding: '0.5rem 0.6rem', color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>
                                                                {new Date(event.timestamp).toLocaleTimeString([], {hour12: false})}
                                                            </td>
                                                            <td style={{ padding: '0.5rem 0.6rem' }}>
                                                                <EventBadge type={event.type} />
                                                            </td>
                                                            <td style={{ padding: '0.5rem 0.6rem' }}>
                                                                <span
                                                                    style={{ 
                                                                        cursor: event.actorUserId ? 'pointer' : 'default',
                                                                        color: event.actorUserId ? 'var(--color-primary)' : 'inherit'
                                                                    }}
                                                                    onClick={() => event.actorUserId && openProfile(event.actorUserId)}
                                                                    title={event.actorUserId ? 'View Profile' : undefined}
                                                                >
                                                                    {event.actorDisplayName}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </GlassPanel>

                                {/* Participants */}
                                <GlassPanel style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={14} /> Participants
                                        </span>
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                                        {eventsByActor.map(([name, count]) => (
                                            <div 
                                                key={name} 
                                                onClick={() => setSelectedActor(name === selectedActor ? null : name)}
                                                style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between', 
                                                    padding: '0.5rem 0.75rem', 
                                                    cursor: 'pointer',
                                                    background: selectedActor === name ? 'rgba(var(--color-primary-rgb), 0.2)' : 'transparent',
                                                    borderRadius: '6px',
                                                    transition: 'background 0.2s',
                                                    marginBottom: '2px'
                                                }}
                                            >
                                                <span style={{ fontSize: '0.85rem', color: selectedActor === name ? 'white' : 'inherit' }}>{name}</span>
                                                <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 6px' }}>{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </GlassPanel>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Clear Database Confirmation Modal */}
            <Modal
                isOpen={isClearConfirmOpen}
                onClose={() => setIsClearConfirmOpen(false)}
                title="Clear Database"
                width="400px"
                footer={
                    <>
                        <NeonButton variant="ghost" onClick={() => setIsClearConfirmOpen(false)}>Cancel</NeonButton>
                        <NeonButton variant="danger" onClick={confirmClear} glow>Yes, Clear Everything</NeonButton>
                    </>
                }
            >
                <div style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                    Are you sure you want to clear the entire instance database?
                    <br /><br />
                    <span style={{ color: '#ef4444', fontWeight: 500 }}>This cannot be undone.</span>
                </div>
            </Modal>

            {/* Rally Confirmation Modal */}
            <Modal
                isOpen={isRallyConfirmOpen}
                onClose={() => { setIsRallyConfirmOpen(false); setRallyResult(null); }}
                title="📣 Rally Session"
                width="400px"
                footer={
                    <>
                        <NeonButton variant="ghost" onClick={() => { setIsRallyConfirmOpen(false); setRallyResult(null); }}>Cancel</NeonButton>
                        <NeonButton variant="primary" onClick={confirmRally} disabled={isRallying} glow>Send Invites</NeonButton>
                    </>
                }
            >
                <div style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                    Invite all users from <strong>{selectedSession?.worldName || 'this session'}</strong> to your current instance.
                </div>
            </Modal>
        </>
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
