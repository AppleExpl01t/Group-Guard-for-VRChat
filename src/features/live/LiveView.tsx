import React, { useState, useEffect, useCallback } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { NeonButton } from '../../components/ui/NeonButton';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Users, Radio, Crosshair, UserPlus, ShieldCheck, Activity } from 'lucide-react';
import { useGroupStore } from '../../stores/groupStore';

// --- Types ---
interface LiveEntity {
    id: string;
    displayName: string;
    rank: string;
    isGroupMember: boolean;
    status: 'active' | 'kicked' | 'joining';
    avatarUrl?: string;
    lastUpdated?: number;
}

interface LogEntry {
    message: string;
    type: 'info' | 'warn' | 'success' | 'error';
    id: number;
}

const EntityCard: React.FC<{ 
    entity: LiveEntity; 
    onInvite: (id: string, name: string) => void;
    onKick: (id: string, name: string) => void;
}> = ({ entity, onInvite, onKick }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '8px',
        marginBottom: '8px',
        transition: 'background 0.2s'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: entity.isGroupMember ? 'rgba(var(--primary-hue), 100%, 50%, 0.2)' : 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: entity.isGroupMember ? 'var(--color-primary)' : 'var(--color-text-dim)',
                overflow: 'hidden'
            }}>
                {entity.avatarUrl ? (
                    <img src={entity.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <Users size={18} />
                )}
            </div>
            <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>{entity.displayName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ 
                        color: entity.isGroupMember ? 'var(--color-primary)' : '#fca5a5',
                        fontWeight: 'bold'
                    }}>
                        {entity.isGroupMember ? 'MEMBER' : 'NON-MEMBER'}
                    </span>
                    <span>•</span>
                    <span>{entity.rank}</span>
                </div>
            </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
            {!entity.isGroupMember && (
                <NeonButton 
                    size="sm" 
                    variant="secondary" 
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => onInvite(entity.id, entity.displayName)}
                >
                    <UserPlus size={14} />
                </NeonButton>
            )}
             <NeonButton 
                size="sm" 
                variant="danger" 
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => onKick(entity.id, entity.displayName)}
            >
                <ShieldAlert size={14} />
            </NeonButton>
        </div>
    </div>
);

export const LiveView: React.FC = () => {
    const { selectedGroup } = useGroupStore();
    const [scanActive] = useState(true);
    const [entities, setEntities] = useState<LiveEntity[]>([]);
    const [instanceInfo, setInstanceInfo] = useState<{ name: string; imageUrl?: string; worldId?: string; instanceId?: string } | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Helpers to add logs
    const addLog = useCallback((message: string, type: 'info' | 'warn' | 'success' | 'error' = 'info') => {
        setLogs(prev => [...prev.slice(-49), { message, type, id: Date.now() + Math.random() }]);
    }, []);

    // Fetch Scan Data
    const performScan = useCallback(async () => {
        if (!selectedGroup) return;
        try {
            // 1. Scan Entities
            const results = await window.electron.instance.scanSector(selectedGroup.id);
            // Merge results to avoid flickering
            setEntities(prev => {
                const map = new Map(prev.map(e => [e.id, e]));
                results.forEach((r: LiveEntity) => {
                    // If we have a fuller record in prev, keep it? No, newer result rules.
                    // But wait, scanSector might return partials if not fetched yet.
                    // Actually scanSector logic in backend returns cache if available.
                    map.set(r.id, r);
                });
                return Array.from(map.values());
            });

            // 2. Fetch Instance Info
            if (window.electron.instance.getInstanceInfo) {
                const info = await window.electron.instance.getInstanceInfo();
                if (info.success) {
                    setInstanceInfo({
                        name: info.name || 'Unknown',
                        imageUrl: info.imageUrl,
                        worldId: info.worldId,
                        instanceId: info.instanceId
                    });
                }
            } else {
                console.warn("[LiveView] getInstanceInfo not found. Please restart the application to update preload scripts.");
            }
        } catch (err) {
            console.error(err);
        }
    }, [selectedGroup]);

    // Initial and Periodic Scan
    useEffect(() => {
        if (!selectedGroup) return;
        
        addLog(`[SYSTEM] Uplink established to ${selectedGroup.name}.`, 'success');
        performScan();

        const interval = setInterval(performScan, 5000); // 5s poll
        return () => clearInterval(interval);
    }, [selectedGroup, performScan, addLog]);

    // Listen for Entity Updates (Live)
    useEffect(() => {
        const unsubscribe = window.electron.instance.onEntityUpdate((updatedEntity: LiveEntity) => {
             setEntities(prev => {
                 const clone = [...prev];
                 const idx = clone.findIndex(e => e.id === updatedEntity.id);
                 if (idx >= 0) {
                     clone[idx] = updatedEntity;
                 } else {
                     clone.push(updatedEntity);
                 }
                 return clone;
             });
             addLog(`[SCAN] Identify: ${updatedEntity.displayName} (${updatedEntity.rank})`, 'info');
        });
        return unsubscribe;
    }, [addLog]);


    // Actions
    const handleRecruit = async (userId: string, name: string) => {
        if (!selectedGroup) return;
        addLog(`[CMD] Inviting ${name}...`, 'info');
        try {
            await window.electron.instance.recruitUser(selectedGroup.id, userId);
            addLog(`[CMD] Invite sent to ${name}`, 'success');
        } catch {
            addLog(`[CMD] Failed to invite ${name}`, 'error');
        }
    };

    const handleKick = async (userId: string, name: string) => {
        if (!selectedGroup) return;
        if (!confirm(`Are you sure you want to KICK (Vote/Ban) ${name}?`)) return;
        
        addLog(`[CMD] Kicking ${name}...`, 'warn');
        try {
            await window.electron.instance.kickUser(selectedGroup.id, userId);
            addLog(`[CMD] Kicked ${name}`, 'success');
             // Update local state to show 'kicked'
             setEntities(prev => prev.map(e => e.id === userId ? { ...e, status: 'kicked' } : e));
        } catch {
            addLog(`[CMD] Failed to kick ${name}`, 'error');
        }
    };
    
    const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);
    const [progressMode, setProgressMode] = useState<'recruit' | 'rally' | null>(null);

    // ... existing code ...

    const handleRecruitAll = async () => {
        if (!entities.length) return;
        const targets = entities.filter(e => !e.isGroupMember && e.status === 'active');
        if (targets.length === 0) {
            addLog(`[CMD] No strangers to recruit.`, 'warn');
            return;
        }
        
        addLog(`[CMD] SENDING MASS INVITES TO ${targets.length} STRANGERS...`, 'warn');
        setProgress({ current: 0, total: targets.length });
        setProgressMode('recruit');
        
        let count = 0;
        for (const t of targets) {
            const res = await window.electron.instance.recruitUser(selectedGroup!.id, t.id);
            
            if (!res.success && res.error === 'RATE_LIMIT') {
                addLog(`[WARN] RATE LIMIT DETECTED! Cooling down for 10s...`, 'warn');
                await new Promise(r => setTimeout(r, 10000));
            }
            
            count++;
            setProgress({ current: count, total: targets.length });
            await new Promise(r => setTimeout(r, 250));
        }
        
        addLog(`[CMD] Recruitment complete. Sent ${count} invites.`, 'success');
        setProgress(null);
        setProgressMode(null);
    };

    // ... existing code ...

    const handleRally = async () => {
        if (!selectedGroup) return;
        
        addLog(`[CMD] Fetching rally targets...`, 'info');
        setIsLoading(true);
        
        try {
             // 1. Get Targets
             const res = await window.electron.instance.getRallyTargets(selectedGroup.id);
             setIsLoading(false);

             if (!res.success || !res.targets || res.targets.length === 0) {
                 addLog(`[CMD] No rally targets found (recent members).`, 'warn');
                 return;
             }

             const targets = res.targets;
             addLog(`[CMD] RALLYING ${targets.length} GROUP MEMBERS...`, 'warn');
             
             setProgress({ current: 0, total: targets.length });
             setProgressMode('rally');

             let count = 0;
             for (const t of targets) {
                 // 2. Invite Loop
                 const invRes = await window.electron.instance.inviteToCurrent(t.id);
                 
                 if (!invRes.success && invRes.error === 'RATE_LIMIT') {
                    addLog(`[WARN] RATE LIMIT DETECTED! Cooling down for 10s...`, 'warn');
                    await new Promise(r => setTimeout(r, 10000));
                 }

                 count++;
                 setProgress({ current: count, total: targets.length });
                 await new Promise(r => setTimeout(r, 250));
             }

             addLog(`[CMD] Rally complete. Sent ${count} invites.`, 'success');

        } catch {
            addLog(`[CMD] Rally error`, 'error');
        } finally {
            setIsLoading(false);
            setProgress(null);
            setProgressMode(null);
        }
    };
    
    // Render logic for the recruitment button
    const renderRecruitButton = () => {
        if (progress && progressMode === 'recruit') {
             const pct = Math.round((progress.current / progress.total) * 100);
             return (
                <NeonButton 
                    disabled
                    style={{ flex: 1, height: '60px', flexDirection: 'column', gap: '4px', position: 'relative', overflow: 'hidden' }}
                >
                    <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${pct}%`,
                        background: 'rgba(var(--primary-hue), 100%, 50%, 0.3)',
                        transition: 'width 0.2s linear'
                    }} />
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{pct}%</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{progress.current}/{progress.total} SENT</span>
                    </div>
                </NeonButton>
             );
        }

        return (
            <NeonButton 
                onClick={handleRecruitAll}
                disabled={progress !== null} 
                style={{ flex: 1, height: '60px', flexDirection: 'column', gap: '4px' }}
            >
                <UserPlus size={20} />
                <span style={{ fontSize: '0.75rem' }}>INVITE INSTANCE TO GROUP</span>
            </NeonButton>
        );
    };

    const renderRallyButton = () => {
        if (progress && progressMode === 'rally') {
             const pct = Math.round((progress.current / progress.total) * 100);
             return (
                <NeonButton 
                    disabled
                    variant="secondary"
                    style={{ flex: 1, height: '60px', flexDirection: 'column', gap: '4px', position: 'relative', overflow: 'hidden' }}
                >
                    <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${pct}%`,
                        background: 'rgba(255, 255, 255, 0.2)', 
                        transition: 'width 0.2s linear'
                    }} />
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{pct}%</span>
                         <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{progress.current}/{progress.total} SENT</span>
                    </div>
                </NeonButton>
             );
        }

        return (
            <NeonButton 
                onClick={handleRally}
                disabled={isLoading || progress !== null}
                variant="secondary" 
                style={{ flex: 1, height: '60px', flexDirection: 'column', gap: '4px' }}
            >
                <ShieldCheck size={20} />
                <span style={{ fontSize: '0.75rem' }}>INVITE GROUP HERE</span>
            </NeonButton>
        );
    };

    const handleLockdown = async () => {
        if (!confirm("⚠️ DANGER ZONE ⚠️\n\nAre you sure you want to CLOSE this instance?\n\nThis will kick ALL players (including you) and lock the instance. This cannot be undone.")) return;
        
        addLog(`[CMD] INITIATING INSTANCE LOCKDOWN...`, 'warn');
        try {
            const res = await window.electron.instance.closeInstance();
            if (res.success) {
                addLog(`[CMD] Instance Closed Successfully.`, 'success');
            } else {
                 addLog(`[CMD] Failed to close instance: ${res.error}`, 'error');
            }
        } catch {
             addLog(`[CMD] Lockdown failed. API Error.`, 'error');
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', gap: '1.5rem', overflow: 'hidden', paddingBottom: '20px' }}>
            
            {/* LEFT COLUMN: SECTOR SCAN (ENTITY LIST) */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
                <GlassPanel style={{ flex: '0 0 auto', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', position: 'relative' }}>
                    {/* Background Image Effect */}
                    {instanceInfo?.imageUrl && (
                        <div style={{ 
                            position: 'absolute', inset: 0, 
                            backgroundImage: `url(${instanceInfo.imageUrl})`, 
                            backgroundSize: 'cover', backgroundPosition: 'center', 
                            opacity: 0.2, filter: 'blur(2px)', zIndex: 0 
                        }} />
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', position: 'relative', zIndex: 1 }}>
                        <div style={{ position: 'relative' }}>
                            {instanceInfo?.imageUrl ? (
                                <img src={instanceInfo.imageUrl} style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid var(--color-primary)', objectFit: 'cover' }} />
                            ) : (
                                <Radio className="text-primary" size={24} />
                            )}
                             {scanActive && (
                                <motion.div 
                                    style={{ position: 'absolute', inset: -4, border: '2px solid var(--color-primary)', borderRadius: instanceInfo?.imageUrl ? '12px' : '50%' }}
                                    animate={{ opacity: [0, 1, 0], scale: [1, 1.2, 1.4] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                             )}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                                {instanceInfo?.name || 'CURRENT INSTANCE'}
                            </h2>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', letterSpacing: '0.05em' }}>
                                {entities.length} PLAYERS DETECTED
                            </div>
                        </div>
                    </div>
                </GlassPanel>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                    <AnimatePresence>
                        {entities.map(entity => (
                            <motion.div
                                key={entity.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                            >
                                <EntityCard 
                                    entity={entity} 
                                    onInvite={handleRecruit}
                                    onKick={handleKick}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {entities.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-dim)' }}>
                            No entities detected in current sector.
                            <br/><span style={{ fontSize: '0.8rem' }}>(Make sure you are in a logged instance)</span>
                        </div>
                    )}
                    <div style={{ height: '40px' }}></div> {/* Spacer */}
                </div>
            </div>

            {/* RIGHT COLUMN: COMMAND UPLINK (ACTIONS & LOGS) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '280px' }}>
                
                {/* TACTICAL ACTIONS */}
                <GlassPanel style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-dim)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Crosshair size={16} />
                        INSTANCE ACTIONS
                    </h3>

                    <div style={{ display: 'grid', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {renderRecruitButton()}
                            {renderRallyButton()}
                        </div>
                         <NeonButton 
                            onClick={handleLockdown}
                            variant="danger" 
                            style={{ width: '100%', height: '40px', fontSize: '0.8rem', opacity: 0.8 }}
                         >
                             <ShieldAlert size={16} style={{ marginRight: '8px' }} />
                             CLOSE INSTANCE
                         </NeonButton>
                    </div>
                </GlassPanel>

                {/* LIVE TERMINAL FEED */}
                <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={14} />
                        SYSTEM FEED
                    </div>
                    <div style={{ flex: 1, padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {logs.map(log => (
                            <div key={log.id} style={{ 
                                color: log.type === 'error' ? '#fca5a5' : 
                                       log.type === 'success' ? '#86efac' : 
                                       log.type === 'warn' ? '#fde047' : 'inherit' 
                            }}>
                                {log.message}
                            </div>
                        ))}
                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '12px', background: 'var(--color-primary)', display: 'block', animation: 'blink 1s infinite' }}></span>
                        </div>
                    </div>
                </GlassPanel>

            </div>
        </div>
    );
};

