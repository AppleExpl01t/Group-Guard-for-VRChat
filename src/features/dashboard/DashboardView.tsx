import React, { useEffect, useState, memo, useRef } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useAuditStore } from '../../stores/auditStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { usePipelineStatus } from '../../hooks/usePipelineInit';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { RefreshTimer } from '../../components/ui/RefreshTimer';
import { PipelineIndicator } from '../../components/ui/PipelineStatus';
import { NeonButton } from '../../components/ui/NeonButton';
import { MembersListDialog } from '../dashboard/dialogs/MembersListDialog';
import { RequestsListDialog } from '../dashboard/dialogs/RequestsListDialog';
import { BansListDialog } from '../dashboard/dialogs/BansListDialog';
import { InstancesListDialog } from '../dashboard/dialogs/InstancesListDialog';
import { StatTile } from './components/StatTile';
import styles from './DashboardView.module.css';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

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

const MEMBER_AFFECTING_EVENTS = [
    'group.user.join',
    'group.user.leave',
    'group.user.ban',
    'group.user.unban',
    'group.user.kick',
    'group.invite.accept',
];

export const DashboardView: React.FC = memo(() => {
    const selectedGroup = useGroupStore(state => state.selectedGroup);
    const requests = useGroupStore(state => state.requests);
    const bans = useGroupStore(state => state.bans);
    const instances = useGroupStore(state => state.instances);
    const isRequestsLoading = useGroupStore(state => state.isRequestsLoading);
    const isBansLoading = useGroupStore(state => state.isBansLoading);
    const isInstancesLoading = useGroupStore(state => state.isInstancesLoading);
    const fetchGroupMembers = useGroupStore(state => state.fetchGroupMembers);
    const isMembersLoading = useGroupStore(state => state.isMembersLoading);

    const logs = useAuditStore(state => state.logs);
    const fetchLogs = useAuditStore(state => state.fetchLogs);
    const isLogsLoading = useAuditStore(state => state.isLoading);
    const pipelineStatus = usePipelineStatus();

    const instancesRefresh = useDataRefresh({ type: 'instances' });
    const requestsRefresh = useDataRefresh({ type: 'requests' });
    const bansRefresh = useDataRefresh({ type: 'bans' });

    const { openProfile } = useUserProfileStore();

    const [showMembers, setShowMembers] = useState(false);
    const [showRequests, setShowRequests] = useState(false);
    const [showBans, setShowBans] = useState(false);
    const [showInstances, setShowInstances] = useState(false);
    const [memberNextRefreshAt, setMemberNextRefreshAt] = useState(0);

    const [activeTab, setActiveTab] = useState<'controls' | 'telemetry'>('controls');

    const lastLogIdRef = useRef<string | null>(null);
    const hasFetchedMembersRef = useRef(false);
    const lastGroupIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedGroup) return;

        if (lastGroupIdRef.current !== selectedGroup.id) {
            hasFetchedMembersRef.current = false;
            lastLogIdRef.current = null;
            lastGroupIdRef.current = selectedGroup.id;
        }

        if (!hasFetchedMembersRef.current) {
            fetchGroupMembers(selectedGroup.id, 0);
            hasFetchedMembersRef.current = true;
        }

        fetchLogs(selectedGroup.id);
    }, [selectedGroup, fetchGroupMembers, fetchLogs]);

    useEffect(() => {
        if (!selectedGroup || logs.length === 0) return;

        // Check if the newest log is different from the last one we processed
        // Logs are sorted desc by default from store
        const newestLog = logs[0];

        if (newestLog.id !== lastLogIdRef.current) {
            // Find all new logs
            const newLogs = [];
            for (const log of logs) {
                if (log.id === lastLogIdRef.current) break;
                newLogs.push(log);
            }

            // Update reference
            lastLogIdRef.current = newestLog.id;

            if (newLogs.length > 0) {
                const hasMemberEvent = newLogs.some(log =>
                    MEMBER_AFFECTING_EVENTS.some(event =>
                        log.eventType?.includes(event) || log.type?.includes(event)
                    )
                );

                if (hasMemberEvent) {
                    fetchGroupMembers(selectedGroup.id, 0);
                }
            }
        }
    }, [logs, selectedGroup, fetchGroupMembers]);

    const handleMemberRefresh = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (memberNextRefreshAt > Date.now() || !selectedGroup) return;
        fetchGroupMembers(selectedGroup.id, 0);
        setMemberNextRefreshAt(Date.now() + 30000);
    };

    const getLogIcon = (type: string) => {
        if (type.includes('ban')) return '🚫';
        if (type.includes('kick')) return '🥾';
        if (type.includes('invite')) return '📩';
        if (type.includes('automod')) return '🤖';
        return '📝';
    };

    const getLogColor = (type: string) => {
        if (type.includes('ban')) return 'var(--color-danger)';
        if (type.includes('kick')) return 'var(--color-warning)';
        if (type.includes('invite')) return 'var(--color-success)';
        if (type.includes('automod')) return 'var(--color-info)';
        return 'var(--color-text-dim)';
    };

    const formatLogEntry = (log: { actorDisplayName: string; description: string; type?: string }) => {
        let actor = log.actorDisplayName;
        let desc = log.description;
        if (desc.endsWith(' by .')) {
            desc = desc.substring(0, desc.length - 5);
        }
        if (actor === 'UNKNOWN' && desc.match(/^\S+ User /)) {
            const parts = desc.split(' ');
            if (parts.length > 0) actor = parts[0];
        }
        let cleanDesc = desc;
        if (actor !== 'UNKNOWN') {
            cleanDesc = cleanDesc.replace(actor, '');
        }
        cleanDesc = cleanDesc.replace(/^\s*User\s+/, ' ');
        cleanDesc = cleanDesc.replace(/by \s*$/, '').trim();
        cleanDesc = cleanDesc.replace(/\s+/g, ' ');
        return { actor, description: cleanDesc };
    };

    return (
        <>
            <motion.div
                className={styles.container}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', padding: '1rem', paddingBottom: 'var(--dock-height)' }}
            >
                {/* Header Section (Stats) */}
                <GlassPanel className={styles.headerPanel} style={{ flexShrink: 0 }}>
                    <div className={styles.titleSection}>
                        <h1 className={`${styles.title} text-gradient`}>
                            {selectedGroup?.name || 'Dashboard'}
                        </h1>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                            <div
                                className={styles.subtitle}
                                style={{ color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)' }}
                            >
                                COMMAND CENTER
                            </div>
                        </div>
                    </div>

                    <div className={styles.statsGrid}>
                        <StatTile
                            label="MEMBERS"
                            value={selectedGroup?.memberCount || 0}
                            color="var(--color-primary)"
                            onClick={() => setShowMembers(true)}
                            headerLeftExtra={pipelineStatus.connected && <PipelineIndicator />}
                            headerRight={
                                <RefreshTimer
                                    nextRefreshAt={memberNextRefreshAt}
                                    isRefreshing={isMembersLoading}
                                    onRefreshClick={handleMemberRefresh}
                                />
                            }
                        />
                        <StatTile
                            label="INSTANCES"
                            value={isInstancesLoading ? '...' : instances.length}
                            color="var(--color-info)"
                            onClick={() => setShowInstances(true)}
                            headerRight={
                                <RefreshTimer
                                    nextRefreshAt={instancesRefresh.nextRefreshAt}
                                    isRefreshing={instancesRefresh.isRefreshing}
                                    onRefreshClick={(e) => { e?.stopPropagation(); instancesRefresh.refreshNow(); }}
                                />
                            }
                        />
                        <StatTile
                            label="REQUESTS"
                            value={isRequestsLoading ? '...' : requests.length}
                            color="var(--color-accent)"
                            onClick={() => setShowRequests(true)}
                            headerRight={
                                <RefreshTimer
                                    nextRefreshAt={requestsRefresh.nextRefreshAt}
                                    isRefreshing={requestsRefresh.isRefreshing}
                                    onRefreshClick={(e) => { e?.stopPropagation(); requestsRefresh.refreshNow(); }}
                                />
                            }
                        />
                        <StatTile
                            label="BANS"
                            value={isBansLoading ? '...' : bans.length}
                            color="var(--color-danger)"
                            onClick={() => setShowBans(true)}
                            headerRight={
                                <RefreshTimer
                                    nextRefreshAt={bansRefresh.nextRefreshAt}
                                    isRefreshing={bansRefresh.isRefreshing}
                                    onRefreshClick={(e) => { e?.stopPropagation(); bansRefresh.refreshNow(); }}
                                />
                            }
                        />
                    </div>
                </GlassPanel>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '1rem', paddingLeft: '0.5rem' }}>
                    <NeonButton
                        variant={activeTab === 'controls' ? 'primary' : 'secondary'}
                        onClick={() => setActiveTab('controls')}
                        size="sm"
                    >
                        Roaming Controls
                    </NeonButton>
                    <NeonButton
                        variant={activeTab === 'telemetry' ? 'primary' : 'secondary'}
                        onClick={() => setActiveTab('telemetry')}
                        size="sm"
                    >
                        Live Telemetry
                    </NeonButton>
                </div>

                {/* Main Content Area (Tabbed) */}
                <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    {activeTab === 'controls' ? (
                        /* Tab 1: Roaming Controls */
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {/* System Status Panel */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>System Status</h3>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                        <span>Pipeline Connection</span>
                                        <PipelineIndicator />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                        <span>Instance Monitor</span>
                                        <span style={{
                                            color: instances.length > 0 ? 'var(--color-success)' : 'var(--color-text-dim)',
                                            fontWeight: 600
                                        }}>
                                            {instances.length > 0 ? 'Active' : 'Standby'}
                                        </span>
                                    </div>
                                </div>

                                {/* Quick Actions Panel */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Quick Actions</h3>
                                    <NeonButton
                                        onClick={() => {
                                            requestsRefresh.refreshNow();
                                            bansRefresh.refreshNow();
                                            instancesRefresh.refreshNow();
                                            fetchGroupMembers(selectedGroup?.id || '', 0);
                                            fetchLogs(selectedGroup?.id || '');
                                        }}
                                        style={{ width: '100%', justifyContent: 'center' }}
                                        variant="secondary"
                                    >
                                        <span style={{ marginRight: '0.5rem' }}>🔄</span> Refresh All Data
                                    </NeonButton>
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(var(--primary-hue), 100%, 50%, 0.1)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Tip:</strong>
                                Use the "Live Telemetry" tab to view real-time audit logs and events.
                            </div>
                        </motion.div>
                    ) : (
                        /* Tab 2: Live Telemetry (Console) */
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
                        >
                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Live Telemetry</h3>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>{logs.length} events</span>
                                    <NeonButton size="sm" variant="secondary" onClick={() => fetchLogs(selectedGroup?.id || '')} disabled={isLogsLoading}>
                                        {isLogsLoading ? 'Refreshing...' : 'Refresh'}
                                    </NeonButton>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', fontFamily: 'monospace' }}>
                                {logs.length === 0 ? (
                                    <div style={{
                                        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--color-text-dim)', flexDirection: 'column', gap: '0.5rem'
                                    }}>
                                        <span style={{ fontSize: '2rem' }}>📝</span>
                                        <span>No recent activity</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {logs.map(log => {
                                            const { actor, description } = formatLogEntry(log);
                                            return (
                                                <motion.div
                                                    key={log.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '1rem',
                                                        padding: '0.75rem',
                                                        background: 'rgba(0,0,0,0.3)',
                                                        borderRadius: '4px',
                                                        borderLeft: `3px solid ${getLogColor(log.type || '')}`
                                                    }}
                                                >
                                                    <div style={{ fontSize: '1.2rem' }}>{getLogIcon(log.type || '')}</div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span
                                                                style={{
                                                                    fontWeight: 600,
                                                                    color: getLogColor(log.type || ''),
                                                                    cursor: 'pointer',
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openProfile(log.actorId);
                                                                }}
                                                                className={styles.clickableActor}
                                                            >
                                                                {actor}
                                                            </span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                                                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)', marginTop: '0.1rem' }}>
                                                            {description}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </GlassPanel>

                <MembersListDialog isOpen={showMembers} onClose={() => setShowMembers(false)} />
                <RequestsListDialog isOpen={showRequests} onClose={() => setShowRequests(false)} />
                <BansListDialog isOpen={showBans} onClose={() => setShowBans(false)} />
                <InstancesListDialog isOpen={showInstances} onClose={() => setShowInstances(false)} />
            </motion.div>
        </>
    );
});

DashboardView.displayName = 'DashboardView';
