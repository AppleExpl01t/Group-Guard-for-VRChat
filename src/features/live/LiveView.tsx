import React, { useState, useEffect, useCallback } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { NeonButton } from '../../components/ui/NeonButton';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, ShieldAlert, Radio, RefreshCw, Activity, UserPlus } from 'lucide-react';
import { AppShieldIcon } from '../../components/ui/AppShieldIcon';
import { useGroupStore } from '../../stores/groupStore';
import { useInstanceMonitorStore, type LiveEntity } from '../../stores/instanceMonitorStore';
import { BanUserDialog } from './dialogs/BanUserDialog';
import { OscAnnouncementWidget } from '../dashboard/widgets/OscAnnouncementWidget';
import { RecruitResultsDialog } from './dialogs/RecruitResultsDialog';
import { AutoModAlertOverlay } from './overlays/AutoModAlertOverlay';
import { useAutoModAlertStore } from '../../stores/autoModAlertStore';
import { ReportGeneratorDialog } from '../reports/ReportGeneratorDialog';
import { StatTile } from '../dashboard/components/StatTile';
import { EntityCard } from './components/EntityCard';

import { useConfirm } from '../../context/ConfirmationContext';
import { useNotificationStore } from '../../stores/notificationStore';
import styles from './LiveView.module.css';

interface LogEntry {
    message: string;
    type: 'info' | 'warn' | 'success' | 'error';
    id: number;
}

interface ReportContext {
    target: { displayName: string; id: string };
    world: { name?: string };
    timestamp: string;
}

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

const ToggleButton = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <div 
        onClick={onToggle}
        className={`${styles.toggle} ${enabled ? styles.toggleEnabled : ''}`}
    >
        <div className={`${styles.toggleKnob} ${enabled ? styles.toggleKnobEnabled : ''}`} />
    </div>
);

export const LiveView: React.FC = () => {
    const { selectedGroup, isRoamingMode } = useGroupStore();
    const { currentWorldName, currentWorldId, instanceImageUrl, liveScanResults, updateLiveScan, setEntityStatus } = useInstanceMonitorStore();
    const scanActive = true;
    const entities = liveScanResults;
    
    const [instanceInfo, setInstanceInfo] = useState<{ name: string; imageUrl?: string; worldId?: string; instanceId?: string } | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [customMessage, setCustomMessage] = useState('');
    

    

    
    // Dialog State
    const [banDialogUser, setBanUserDialog] = useState<{ id: string; displayName: string } | null>(null);
    const [recruitResults, setRecruitResults] = useState<{ blocked: {name:string, reason?:string}[], invited: number } | null>(null);
    
    // Report Dialog State
    const [reportContext, setReportContext] = useState<ReportContext | null>(null);
    
    // Tab state for entity list
    const [entityTab, setEntityTab] = useState<'active' | 'left'>('active');

    const { confirm } = useConfirm();
    const { addNotification } = useNotificationStore();

    // Helpers to add logs
    const addLog = useCallback((message: string, type: 'info' | 'warn' | 'success' | 'error' = 'info') => {
        setLogs(prev => [...prev.slice(-49), { message, type, id: Date.now() + Math.random() }]);
    }, []);

    const handleBanClick = (userId: string, name: string) => {
        setBanUserDialog({ id: userId, displayName: name });
    };

    const handleReportClick = (userId: string, name: string) => {
        setReportContext({
            target: { displayName: name, id: userId },
            world: { name: instanceInfo?.name },
            timestamp: new Date().toISOString()
        });
    };

    const performScan = useCallback(async () => {
        if (!selectedGroup && !isRoamingMode) return;
        
        try {
            const scanGroupId = selectedGroup ? selectedGroup.id : undefined;
            const results = await window.electron.instance.scanSector(scanGroupId);
            updateLiveScan(results as LiveEntity[]);

            if (window.electron.instance.getInstanceInfo) {
                const info = await window.electron.instance.getInstanceInfo();
                if (info.success) {
                    setInstanceInfo({
                        name: info.name || currentWorldName || 'Unknown',
                        imageUrl: info.imageUrl || instanceImageUrl || undefined,
                        worldId: info.worldId || currentWorldId || undefined,
                        instanceId: info.instanceId || undefined
                    });
                }
            } else {
                setInstanceInfo({
                    name: currentWorldName || 'Unknown',
                    imageUrl: instanceImageUrl || undefined,
                    worldId: currentWorldId || undefined,
                    instanceId: undefined
                });
            }
        } catch (err) {
            console.error(err);
        }
    }, [selectedGroup, isRoamingMode, currentWorldName, currentWorldId, instanceImageUrl, updateLiveScan]);

    // Initial and Periodic Scan
    useEffect(() => {
        if (!selectedGroup && !isRoamingMode) return;
        
        if (selectedGroup) {
            addLog(`[SYSTEM] Uplink established to ${selectedGroup.name}.`, 'success');
        } else {
            setLogs(prev => {
                const lastLog = prev[prev.length - 1];
                if (lastLog && lastLog.message.includes('ROAMING MODE ENGAGED')) return prev;
                return [...prev.slice(-49), { message: `[SYSTEM] ROAMING MODE ENGAGED. Passive Monitoring Active.`, type: 'warn', id: Date.now() }];
            });
        }

        performScan();

        const interval = setInterval(performScan, 5000);
        return () => clearInterval(interval);
    }, [selectedGroup, isRoamingMode, performScan, addLog]);

    // Listen for Entity Updates (Live)
    useEffect(() => {
        const unsubscribe = window.electron.instance.onEntityUpdate((updatedEntity: LiveEntity) => {
            addLog(`[SCAN] Profile Resolved: ${updatedEntity.displayName} (Rank: ${updatedEntity.rank})`, 'info');
        });
        return unsubscribe;
    }, [addLog]);

    // LOG WATCHER INTEGRATION
    useEffect(() => {
        window.electron.logWatcher.start();
        
        const unsubKick = window.electron.logWatcher.onVoteKick((event) => {
            addLog(`[VOTE KICK] ${event.initiator} initiated vote kick against ${event.target}`, 'warn');
        });

        const unsubVideo = window.electron.logWatcher.onVideoPlay((event) => {
            const shortUrl = event.url.length > 50 ? event.url.substring(0, 47) + '...' : event.url;
            addLog(`[VIDEO] Now Playing: ${shortUrl} (Req: ${event.requestedBy})`, 'info');
        });

        return () => {
            unsubKick();
            unsubVideo();
        };
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
        
        const confirmed = await confirm({
            title: 'Confirm Kick',
            message: `Are you sure you want to KICK (Vote/Ban) ${name}?`,
            confirmLabel: 'Kick',
            variant: 'warning'
        });

        if (!confirmed) return;
        
        addLog(`[CMD] Kicking ${name}...`, 'warn');
        try {
            await window.electron.instance.kickUser(selectedGroup.id, userId);
            addLog(`[CMD] Kicked ${name}`, 'success');
            setEntityStatus(userId, 'kicked');
        } catch {
            addLog(`[CMD] Failed to kick ${name}`, 'error');
            addNotification({
                type: 'error',
                title: 'Kick Failed',
                message: `Failed to kick ${name}`
            });
        }
    };
    
    const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);
    const [progressMode, setProgressMode] = useState<'recruit' | 'rally' | null>(null);
    const [currentProcessingUser, setCurrentProcessingUser] = useState<{ name: string; phase: 'checking' | 'inviting' | 'skipped' } | null>(null);

    const handleRecruitAll = async () => {
        if (!selectedGroup) {
            addLog(`[CMD] Cannot invite without a selected group.`, 'warn');
            return;
        }
        if (!entities.length) {
            addLog(`[CMD] No players detected yet. Try leaving and re-entering the instance.`, 'warn');
            return;
        }
        const targets = entities.filter(e => !e.isGroupMember && e.status === 'active');
        if (targets.length === 0) {
            addLog(`[CMD] No strangers to recruit.`, 'warn');
            return;
        }
        
        addLog(`[CMD] SENDING MASS INVITES TO ${targets.length} STRANGERS...`, 'warn');
        
        let keywordRuleInvoked = false;
        try {
            const rules = await window.electron.automod.getRules(selectedGroup.id);
            keywordRuleInvoked = rules.some(r => r.type === 'KEYWORD_BLOCK' && r.enabled);
            if (keywordRuleInvoked) {
                addLog(`[AUTOMOD] Keyword Filter Active: Scanning profiles...`, 'info');
            }
        } catch (e) {
            console.error("Failed to fetch automod rules", e);
        }

        setProgress({ current: 0, total: targets.length });
        setProgressMode('recruit');
        
        let count = 0;
        const blocked: { name: string; reason?: string }[] = [];
        
        for (const t of targets) {
            if (keywordRuleInvoked) {
                setCurrentProcessingUser({ name: t.displayName, phase: 'checking' });
                await new Promise(r => setTimeout(r, 200));
                
                try {
                    const userRes = await window.electron.getUser(t.id);
                    if (userRes.success && userRes.user) {
                        const checkRes = await window.electron.automod.checkUser({
                            id: t.id,
                            displayName: t.displayName,
                            tags: userRes.user.tags,
                            bio: userRes.user.bio,
                            status: userRes.user.status,
                            statusDescription: userRes.user.statusDescription,
                            pronouns: userRes.user.pronouns
                        }, selectedGroup.id);

                        if (checkRes.action === 'REJECT' || checkRes.action === 'AUTO_BLOCK') {
                            setCurrentProcessingUser({ name: t.displayName, phase: 'skipped' });
                            blocked.push({ name: t.displayName, reason: checkRes.reason });
                            addLog(`[AUTOMOD] Skipped ${t.displayName} (Match: ${checkRes.reason})`, 'warn');
                            setProgress({ current: count + blocked.length, total: targets.length });
                            await new Promise(r => setTimeout(r, 300));
                            continue; 
                        }
                    }
                } catch (e) {
                    console.error("AutoMod check failed for user", t.displayName, e);
                }
            }
            
            setCurrentProcessingUser({ name: t.displayName, phase: 'inviting' });
            const res = await window.electron.instance.recruitUser(selectedGroup!.id, t.id);
            
            if (!res.success && res.error === 'RATE_LIMIT') {
                addLog(`[WARN] RATE LIMIT DETECTED! Cooling down for 10s...`, 'warn');
                await new Promise(r => setTimeout(r, 10000));
            }
            
            count++;
            setProgress({ current: count + blocked.length, total: targets.length });
            await new Promise(r => setTimeout(r, 250));
        }
        
        addLog(`[CMD] Recruitment complete. Sent ${count} invites.`, 'success');
        
        if (keywordRuleInvoked || blocked.length > 0) {
            if (blocked.length > 0) {
                addLog(`[AUTOMOD] Blocked ${blocked.length} users from invite list.`, 'warn');
            } else {
                addLog(`[AUTOMOD] All users passed AutoMod check.`, 'success');
            }
            setRecruitResults({ blocked, invited: count });
        }
        
        setCurrentProcessingUser(null);
        setProgress(null);
        setProgressMode(null);
    };

    const handleRally = async () => {
        if (!selectedGroup) return;
        
        addLog(`[CMD] Fetching rally targets...`, 'info');
        setIsLoading(true);
        
        try {
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
                const invRes = await window.electron.instance.inviteToCurrent(t.id ?? '', customMessage);
                
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
    
    const renderRecruitButton = () => {
        if (progress && progressMode === 'recruit') {
            const pct = Math.round((progress.current / progress.total) * 100);
            
            let statusText = `${progress.current}/${progress.total} PROCESSED`;
            let statusColor = 'inherit';
            
            if (currentProcessingUser) {
                const truncatedName = currentProcessingUser.name.length > 15 
                    ? currentProcessingUser.name.substring(0, 15) + '...' 
                    : currentProcessingUser.name;
                    
                if (currentProcessingUser.phase === 'checking') {
                    statusText = `🔍 Checking: ${truncatedName}`;
                    statusColor = '#fde047';
                } else if (currentProcessingUser.phase === 'inviting') {
                    statusText = `📨 Inviting: ${truncatedName}`;
                    statusColor = '#86efac';
                } else if (currentProcessingUser.phase === 'skipped') {
                    statusText = `⛔ Skipped: ${truncatedName}`;
                    statusColor = '#fca5a5';
                }
            }
            
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
                        <span style={{ fontSize: '0.65rem', color: statusColor, fontWeight: 500 }}>{statusText}</span>
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
        if (!selectedGroup) {
            return (
                <NeonButton 
                    disabled
                    variant="secondary" 
                    style={{ flex: 1, height: '60px', flexDirection: 'column', gap: '4px', opacity: 0.5 }}
                >
                    <AppShieldIcon size={20} />
                    <span style={{ fontSize: '0.75rem' }}>GROUP OFF-LINE</span>
                </NeonButton>
            );
        }

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
                <AppShieldIcon size={20} />
                <span style={{ fontSize: '0.75rem' }}>INVITE GROUP HERE</span>
            </NeonButton>
        );
    };

    const handleLockdown = async () => {
        const confirmed = await confirm({
            title: '⚠️ DANGER ZONE ⚠️',
            message: "Are you sure you want to CLOSE this instance?\n\nThis will kick ALL players (including you) and lock the instance. This cannot be undone.",
            confirmLabel: 'CLOSE INSTANCE',
            variant: 'danger'
        });

        if (!confirmed) return;
        
        addLog(`[CMD] INITIATING INSTANCE LOCKDOWN...`, 'warn');
        try {
            const res = await window.electron.instance.closeInstance();
            if (res.success) {
                addLog(`[CMD] Instance Closed Successfully.`, 'success');
                addNotification({
                    type: 'success',
                    title: 'Instance Closed',
                    message: 'Lockdown successful.'
                });
            } else {
                addLog(`[CMD] Failed to close instance: ${res.error}`, 'error');
                addNotification({
                    type: 'error',
                    title: 'Lockdown Failed',
                    message: res.error || 'Unknown error'
                });
            }
        } catch {
            addLog(`[CMD] Lockdown failed. API Error.`, 'error');
            addNotification({
                type: 'error',
                title: 'Error',
                message: 'Lockdown failed due to API error.'
            });
        }
    };

    // Derived counts
    const activeCount = entities.filter(e => e.status === 'active' || e.status === 'joining').length;
    const leftCount = entities.filter(e => e.status === 'left' || e.status === 'kicked').length;

    return (
        <>
            <motion.div 
                className={styles.container}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', padding: '1rem', paddingBottom: 'var(--dock-height)' }}
            >
                {/* Header Panel */}
                <GlassPanel className={styles.headerPanel}>
                    {instanceInfo?.imageUrl && (
                        <div 
                            className={styles.headerBackground} 
                            style={{ backgroundImage: `url(${instanceInfo.imageUrl})` }} 
                        />
                    )}
                    
                    <div className={styles.titleSection}>
                        <div className={styles.instanceIcon}>
                            {instanceInfo?.imageUrl ? (
                                <img src={instanceInfo.imageUrl} className={styles.instanceImage} alt="" />
                            ) : (
                                <Radio className="text-primary" size={24} />
                            )}
                            {scanActive && <div className={styles.scanPulse} />}
                        </div>
                        <div>
                            <h1 className={`${styles.title} text-gradient`}>
                                {instanceInfo?.name || currentWorldName || 'CURRENT INSTANCE'}
                            </h1>
                            <div className={styles.subtitle}>
                                {isRoamingMode ? 'ROAMING MODE - PASSIVE MONITORING' : 'LIVE SECTOR SCAN'}
                            </div>
                        </div>
                    </div>

                    <div className={styles.statsGrid}>
                        <StatTile 
                            label="ACTIVE"
                            value={activeCount}
                            color="var(--color-success)"
                        />
                        <StatTile 
                            label="HISTORY"
                            value={leftCount}
                            color="var(--color-text-dim)"
                        />
                        <StatTile 
                            label="STATUS"
                            value={scanActive ? "SCANNING" : "IDLE"}
                            color={scanActive ? "var(--color-primary)" : "var(--color-text-dim)"}
                        />
                    </div>
                </GlassPanel>

                {/* Main Content Split */}
                <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
                    
                    {/* Left: Entity List (2/3 width) */}
                    <GlassPanel style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                        {/* Tab Header */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setEntityTab('active')}
                                className={`${styles.entityTab} ${entityTab === 'active' ? styles.entityTabActive : ''}`}
                            >
                                <div className={`${styles.tabIndicator} ${entityTab === 'active' ? styles.tabIndicatorActive : ''}`} />
                                IN INSTANCE
                                <span className={`${styles.tabBadge} ${entityTab === 'active' ? styles.tabBadgeActive : ''}`}>
                                    {activeCount}
                                </span>
                            </button>
                            
                            <button
                                onClick={() => setEntityTab('left')}
                                className={`${styles.entityTab} ${entityTab === 'left' ? styles.entityTabLeft : ''}`}
                            >
                                <div className={styles.tabIndicator} />
                                RECENTLY LEFT
                                <span className={styles.tabBadge}>
                                    {leftCount}
                                </span>
                            </button>
                            
                            <div style={{ width: '1px', background: 'var(--border-color)', margin: '5px 0' }} />

                            <button
                                onClick={() => performScan()}
                                title="Force Refresh"
                                style={{
                                    padding: '0 1rem',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--color-text-dim)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.2s ease',
                                }}
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>

                        {/* Entity List Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                            <AnimatePresence mode="wait">
                                {entityTab === 'active' ? (
                                    <motion.div
                                        key="active-tab"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        {activeCount === 0 ? (
                                            <div className={styles.emptyState}>
                                                No active entities.<br/>
                                                <span style={{ fontSize: '0.8rem' }}>(Instance is empty)</span>
                                            </div>
                                        ) : (
                                            entities.filter(e => e.status === 'active' || e.status === 'joining').map(entity => (
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
                                                        onBan={handleBanClick}
                                                        onReport={handleReportClick}
                                                        readOnly={isRoamingMode}
                                                    />
                                                </motion.div>
                                            ))
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="left-tab"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        {leftCount === 0 ? (
                                            <div className={styles.emptyStateHistory}>
                                                History empty
                                            </div>
                                        ) : (
                                            entities.filter(e => e.status === 'left' || e.status === 'kicked').map(entity => (
                                                <motion.div
                                                    key={entity.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 0.6 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <EntityCard 
                                                        entity={entity} 
                                                        onInvite={() => {}} 
                                                        onKick={() => {}}
                                                        onBan={handleBanClick}
                                                        onReport={handleReportClick}
                                                        readOnly={true}
                                                    />
                                                </motion.div>
                                            ))
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </GlassPanel>

                    {/* Right: Actions & Logs (1/3 width) */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '280px' }}>
                        
                        {/* Actions Panel */}
                        <GlassPanel style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h3 className={styles.actionsHeader}>
                                <Crosshair size={16} />
                                {isRoamingMode ? 'ROAMING CONTROLS' : 'INSTANCE ACTIONS'}
                            </h3>

                            <div style={{ marginBottom: '0.5rem' }}>
                                <OscAnnouncementWidget />
                            </div>

                            {/* Alerts & AutoBan Toggle */}
                            <div className={styles.toggleRow}>
                                <div className={styles.toggleItem}>
                                    <div className={styles.toggleLabel}>
                                        <ShieldAlert size={16} color={useAutoModAlertStore(s => s.isEnabled) ? '#f87171' : 'gray'} />
                                        <span>Alerts</span>
                                    </div>
                                    <ToggleButton 
                                        enabled={useAutoModAlertStore(s => s.isEnabled)} 
                                        onToggle={useAutoModAlertStore(s => s.toggleEnabled)} 
                                    />
                                </div>
                                
                                <div className={styles.toggleDivider} />
                                

                            </div>

                            {/* Custom Invite Message */}
                            {!isRoamingMode && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <input 
                                        type="text" 
                                        placeholder="Custom Invite Message (Optional)..." 
                                        value={customMessage}
                                        onChange={(e) => setCustomMessage(e.target.value)}
                                        className={styles.messageInput}
                                    />
                                    {customMessage && (
                                        <div className={styles.messageWarning}>
                                            Warning: Overwrites Invite Slot 12
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px' }}>
                                {renderRecruitButton()}
                                {renderRallyButton()}
                            </div>
                            
                            {!isRoamingMode && selectedGroup && (
                                <NeonButton 
                                    variant="danger" 
                                    style={{ height: '40px', fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}
                                    onClick={handleLockdown}
                                >
                                    <ShieldAlert size={16} />
                                    EMERGENCY LOCKDOWN
                                </NeonButton>
                            )}
                        </GlassPanel>

                        {/* Log Terminal */}
                        <GlassPanel className={styles.logTerminal}>
                            <div className={styles.logHeader}>
                                <Activity size={14} />
                                LIVE TELEMETRY
                            </div>
                            
                            <div className={styles.logContent}>
                                {logs.slice().reverse().map(log => (
                                    <div 
                                        key={log.id} 
                                        className={`${styles.logEntry} ${
                                            log.type === 'error' ? styles.logEntryError : 
                                            log.type === 'warn' ? styles.logEntryWarn : 
                                            log.type === 'success' ? styles.logEntrySuccess : ''
                                        }`}
                                    >
                                        {log.message}
                                    </div>
                                ))}
                            </div>
                        </GlassPanel>
                    </div>
                </div>
            </motion.div>

            {/* Dialogs */}
            <AnimatePresence>
                {banDialogUser && selectedGroup && (
                    <BanUserDialog 
                        key={banDialogUser ? banDialogUser.id : 'closed'}
                        isOpen={!!banDialogUser} 
                        onClose={() => setBanUserDialog(null)}
                        user={banDialogUser}
                        initialGroupId={selectedGroup?.id}
                    />
                )}
                
                {recruitResults && selectedGroup && (
                    <RecruitResultsDialog 
                        isOpen={!!recruitResults}
                        onClose={() => setRecruitResults(null)}
                        blockedUsers={recruitResults?.blocked || []}
                        totalInvited={recruitResults?.invited || 0}
                    />
                )}
            </AnimatePresence>

            {/* AutoMod Alert Overlay */}
            <AutoModAlertOverlay />
            
            {/* Report Generator Dialog */}
            <ReportGeneratorDialog
                isOpen={!!reportContext}
                onClose={() => setReportContext(null)}
                context={reportContext}
            />
        </>
    );
};
