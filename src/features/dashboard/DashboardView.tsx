import React, { useEffect, useState, memo } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useAuditStore } from '../../stores/auditStore';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { usePipelineStatus } from '../../hooks/usePipelineInit';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { NeonButton } from '../../components/ui/NeonButton';
import { RefreshTimer } from '../../components/ui/RefreshTimer';
import { PipelineIndicator } from '../../components/ui/PipelineStatus';
import { MembersListDialog } from '../dashboard/dialogs/MembersListDialog';
import { RequestsListDialog } from '../dashboard/dialogs/RequestsListDialog';
import { BansListDialog } from '../dashboard/dialogs/BansListDialog';
import { InstancesListDialog } from '../dashboard/dialogs/InstancesListDialog';
import { InstanceMonitorWidget } from './widgets/InstanceMonitorWidget';

// Audit event types that affect member count
const MEMBER_AFFECTING_EVENTS = [
  'group.user.join',
  'group.user.leave', 
  'group.user.ban',
  'group.user.unban',
  'group.user.kick',
  'group.invite.accept',
];

export const DashboardView: React.FC = memo(() => {
  const { 
      selectedGroup, 
      requests, 
      bans,
      instances,
      isRequestsLoading,
      isBansLoading,
      isInstancesLoading,
      fetchGroupMembers,
      isMembersLoading,
  } = useGroupStore();
  const { logs, fetchLogs, isLoading: isLogsLoading } = useAuditStore();
  
  // Pipeline WebSocket connection status
  const pipelineStatus = usePipelineStatus();
  
  // Auto-refresh hooks with visual timers
  const instancesRefresh = useDataRefresh({ type: 'instances' });
  const requestsRefresh = useDataRefresh({ type: 'requests' });
  const bansRefresh = useDataRefresh({ type: 'bans' });
  
  const [showMembers, setShowMembers] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showBans, setShowBans] = useState(false);
  const [showInstances, setShowInstances] = useState(false);
  
  // Member refresh state with 30s cooldown
  const [memberRefreshCooldown, setMemberRefreshCooldown] = useState(0);
  const lastLogCountRef = React.useRef(0);
  const hasFetchedMembersRef = React.useRef(false);
  const lastGroupIdRef = React.useRef<string | null>(null);

  // Initial member fetch (once per app open) and reset on group change
  useEffect(() => {
    if (!selectedGroup) return;
    
    // Reset if group changed
    if (lastGroupIdRef.current !== selectedGroup.id) {
      hasFetchedMembersRef.current = false;
      lastLogCountRef.current = 0;
      lastGroupIdRef.current = selectedGroup.id;
    }
    
    // Initial fetch
    if (!hasFetchedMembersRef.current) {
      fetchGroupMembers(selectedGroup.id, 0);
      hasFetchedMembersRef.current = true;
    }
  }, [selectedGroup, fetchGroupMembers]);

  // Watch audit logs for member-affecting events
  useEffect(() => {
    if (!selectedGroup || logs.length === 0) return;
    
    const lastCount = lastLogCountRef.current;
    
    // Check if we have new logs since last check
    if (logs.length > lastCount && lastCount > 0) {
      // Check if any new log is a member-affecting event
      const newLogs = logs.slice(0, logs.length - lastCount);
      const hasMemberEvent = newLogs.some(log => 
        MEMBER_AFFECTING_EVENTS.some(event => 
          log.eventType?.includes(event) || log.type?.includes(event)
        )
      );
      
      if (hasMemberEvent) {
        // Refresh member count
        fetchGroupMembers(selectedGroup.id, 0);
      }
    }
    
    lastLogCountRef.current = logs.length;
  }, [logs, selectedGroup, fetchGroupMembers]);

  // Cooldown timer
  useEffect(() => {
    if (memberRefreshCooldown > 0) {
      const timer = setTimeout(() => {
        setMemberRefreshCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [memberRefreshCooldown]);

  const handleMemberRefresh = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (memberRefreshCooldown > 0 || !selectedGroup) return;
    
    fetchGroupMembers(selectedGroup.id, 0);
    setMemberRefreshCooldown(30); // 30 second cooldown
  };

  useEffect(() => {
    if (selectedGroup) {
      fetchLogs(selectedGroup.id);
    }
  }, [selectedGroup, fetchLogs]);

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem', paddingBottom: '20px' }}>
      
        {/* Top Header & Stats Row */}
        <GlassPanel style={{ flex: '0 0 auto', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ minWidth: '200px' }}>
                <h1 className="text-gradient" style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800, lineHeight: 1.2 }}>
                    {selectedGroup?.name || 'Dashboard'}
                </h1>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginTop: '4px' }}>
                    COMMAND CENTER
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                
                {/* Member Count Tile */}
                <div 
                    onClick={() => setShowMembers(true)}
                    style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', minWidth: '130px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <small style={{ color: 'var(--color-primary)', fontSize: '0.7rem', fontWeight: 600 }}>MEMBERS</small>
                            {pipelineStatus.connected && <PipelineIndicator />}
                        </div>
                        <RefreshTimer secondsUntilRefresh={memberRefreshCooldown} isRefreshing={isMembersLoading} onRefreshClick={handleMemberRefresh} />
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{selectedGroup?.memberCount}</div>
                </div>

                {/* Active Instances Tile */}
                <div 
                    onClick={() => setShowInstances(true)}
                    style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', minWidth: '130px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <small style={{ color: '#4cc9f0', fontSize: '0.7rem', fontWeight: 600 }}>INSTANCES</small>
                        <RefreshTimer secondsUntilRefresh={instancesRefresh.secondsUntilRefresh} isRefreshing={instancesRefresh.isRefreshing} onRefreshClick={(e) => { e?.stopPropagation(); instancesRefresh.refreshNow(); }} />
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{isInstancesLoading ? '...' : instances.length}</div>
                </div>

                {/* Requests Tile */}
                <div 
                    onClick={() => setShowRequests(true)}
                    style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', minWidth: '130px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <small style={{ color: 'var(--color-accent)', fontSize: '0.7rem', fontWeight: 600 }}>REQUESTS</small>
                        <RefreshTimer secondsUntilRefresh={requestsRefresh.secondsUntilRefresh} isRefreshing={requestsRefresh.isRefreshing} onRefreshClick={(e) => { e?.stopPropagation(); requestsRefresh.refreshNow(); }} />
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{isRequestsLoading ? '...' : requests.length}</div>
                </div>

                {/* Bans Tile */}
                <div 
                    onClick={() => setShowBans(true)}
                    style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', minWidth: '130px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <small style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 600 }}>BANS</small>
                        <RefreshTimer secondsUntilRefresh={bansRefresh.secondsUntilRefresh} isRefreshing={bansRefresh.isRefreshing} onRefreshClick={(e) => { e?.stopPropagation(); bansRefresh.refreshNow(); }} />
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{isBansLoading ? '...' : bans.length}</div>
                </div>
            </div>
        </GlassPanel>

        {/* Main Content Area: 2 Columns */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '1.5rem', minHeight: 0 }}>
            
            {/* Left: Audit Log Feed */}
            <GlassPanel style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flex: '0 0 auto', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Live Audit Feed</h3>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                    </div>
                    <NeonButton size="sm" variant="ghost" onClick={() => selectedGroup && fetchLogs(selectedGroup.id)} disabled={isLogsLoading}>
                        {isLogsLoading ? 'SYNCING...' : 'REFRESH'}
                    </NeonButton>
                </div>
                
                <div 
                    style={{ 
                        flex: 1, 
                        overflowY: 'auto',  // Always scrollable in full mode
                        paddingRight: '4px',
                        minHeight: 0 // Crucial for flex box scrolling
                    }}
                >
                    {logs.length === 0 && !isLogsLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-dim)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                            -- No visible spectrum events --
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} style={{ 
                                padding: '0.75rem 0.5rem', 
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                fontSize: '0.85rem',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ 
                                    width: '8px', height: '8px', 
                                    flex: '0 0 auto',
                                    borderRadius: '50%', 
                                    background: log.eventType?.includes('ban') ? '#ef4444' : (log.eventType?.includes('join') ? '#22c55e' : 'var(--color-accent)'),
                                    boxShadow: log.eventType?.includes('ban') ? '0 0 8px rgba(239, 68, 68, 0.4)' : 'none'
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: '600', color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                                            {log.actorDisplayName}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontFamily: 'monospace' }}>
                                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>
                                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
                                        {log.description || log.eventType}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </GlassPanel>

            {/* Right: Instance Monitor */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <InstanceMonitorWidget />
            </div>
        </div>

        {/* Dialogs */}
        <MembersListDialog 
        isOpen={showMembers} 
        onClose={() => setShowMembers(false)} 
      />
      
      <RequestsListDialog
          isOpen={showRequests}
          onClose={() => setShowRequests(false)}
      />

      <BansListDialog
          isOpen={showBans}
          onClose={() => setShowBans(false)}
      />

      <InstancesListDialog
          isOpen={showInstances}
          onClose={() => setShowInstances(false)}
      />

      {/* Global User Profile Dialog */}
      {/* <UserProfileDialog /> */}
    </div>
    </>
  );
});

DashboardView.displayName = 'DashboardView';
