import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuditStore, type AuditLogEntry } from '../../stores/auditStore';
import { useGroupStore } from '../../stores/groupStore';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { NeonButton } from '../../components/ui/NeonButton';
import { StatTile } from '../dashboard/components/StatTile';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, RefreshCw, Ban, UserMinus, Bot, Mail, Key } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmationContext';
import { useNotificationStore } from '../../stores/notificationStore';
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

export const AuditLogView: React.FC = () => {
  const { selectedGroup } = useGroupStore();
  const { logs, isLoading, error, fetchLogs } = useAuditStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { confirm } = useConfirm();
  const { addNotification } = useNotificationStore();

  const loadLogs = useCallback(async () => {
    if (selectedGroup) {
      fetchLogs(selectedGroup.id);
    }
  }, [selectedGroup, fetchLogs]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = async () => {
    if (selectedGroup) {
        setIsRefreshing(true);
        await fetchLogs(selectedGroup.id);
        setIsRefreshing(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const type = log.type || '';
      if (filterType !== 'all') {
          if (filterType === 'ban' && !type.includes('ban')) return false;
          if (filterType === 'kick' && !type.includes('kick')) return false;
          if (filterType === 'invite' && !type.includes('invite')) return false;
          if (filterType === 'automod' && !type.includes('automod')) return false;
          if (filterType === 'role' && !type.includes('role')) return false;
      }
      
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (log.actorDisplayName || '').toLowerCase().includes(query) ||
        (log.targetDisplayName || '').toLowerCase().includes(query) ||
        (log.description || '').toLowerCase().includes(query) ||
        (log.type || '').toLowerCase().includes(query)
      );
    });
  }, [logs, searchQuery, filterType]);

  const handleUndo = async (log: AuditLogEntry, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!selectedGroup) return;
      
      if (log.type === 'group.user.ban' && log.targetId) {
          const confirmed = await confirm({
              title: 'Undo Ban',
              message: `Are you sure you want to UNBAN ${log.targetDisplayName}?`,
              confirmLabel: 'Unban',
              variant: 'warning'
          });

          if (confirmed) {
              try {
                  const result = await window.electron.unbanUser(selectedGroup.id, log.targetId);
                  if (result.success) {
                      addNotification({ type: 'success', title: 'Unbanned', message: `Successfully unbanned ${log.targetDisplayName}` });
                      loadLogs(); // Refresh logs
                  } else {
                      addNotification({ type: 'error', title: 'Failed', message: `Failed to unban: ${result.error}` });
                  }
              } catch (e) {
                  console.error(e);
                  addNotification({ type: 'error', title: 'Error', message: 'Failed to execute undo action' });
              }
          }
      } else {
          addNotification({ type: 'warning', title: 'Unavailable', message: 'Undo action not available for this event type yet.' });
      }
  };

  // Stats
  const banCount = logs.filter(l => (l.type || '').includes('ban')).length;
  const kickCount = logs.filter(l => (l.type || '').includes('kick')).length;
  const automodCount = logs.filter(l => (l.type || '').includes('automod')).length;

  if (!selectedGroup) return null;

  const filterButtons = [
    { value: 'all', label: 'All', icon: null },
    { value: 'ban', label: 'Bans', icon: Ban },
    { value: 'kick', label: 'Kicks', icon: UserMinus },
    { value: 'automod', label: 'AutoMod', icon: Bot },
    { value: 'invite', label: 'Invites', icon: Mail },
    { value: 'role', label: 'Roles', icon: Key },
  ];

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
                      Audit Logs
                  </h1>
                  <div className={styles.subtitle}>
                      GROUP ACTIVITY HISTORY
                  </div>
              </div>

              <div className={styles.statsGrid}>
                  <StatTile 
                      label="TOTAL EVENTS"
                      value={logs.length}
                      color="var(--color-primary)"
                  />
                  <StatTile 
                      label="BANS"
                      value={banCount}
                      color="var(--color-danger)"
                  />
                  <StatTile 
                      label="KICKS"
                      value={kickCount}
                      color="var(--color-warning)"
                  />
                  <StatTile 
                      label="AUTOMOD"
                      value={automodCount}
                      color="#a855f7"
                  />
              </div>
          </GlassPanel>

          {/* Main Content Split */}
          <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
              
              {/* Left: Log List */}
              <GlassPanel style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, flexShrink: 0 }}>Activity Log</h3>
                      
                      {/* Search */}
                      <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                          <Search 
                              style={{ 
                                  position: 'absolute', 
                                  left: '12px', 
                                  top: '50%', 
                                  transform: 'translateY(-50%)', 
                                  color: 'var(--color-text-dim)' 
                              }} 
                              size={16} 
                          />
                          <input 
                              type="text"
                              placeholder="Search logs..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              style={{
                                  width: '100%',
                                  padding: '0.5rem 1rem 0.5rem 2.25rem',
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '6px',
                                  color: 'white',
                                  fontSize: '0.85rem',
                                  outline: 'none'
                              }}
                          />
                      </div>
                      
                      <NeonButton onClick={handleRefresh} size="sm" variant="secondary" disabled={isRefreshing || isLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
                      </NeonButton>
                  </div>
                  
                  {/* Log Body */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {isLoading && logs.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-dim)' }}>Loading logs...</div>
                      ) : error ? (
                          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-danger)' }}>{error}</div>
                      ) : filteredLogs.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '2rem' }}>📋</span>
                              <span>No logs found matching your criteria.</span>
                          </div>
                      ) : (
                          <AnimatePresence>
                              {filteredLogs.map((log) => (
                                  <AuditLogCard key={`${log.id}-${log.created_at}`} log={log} onUndo={(e) => handleUndo(log, e)} />
                              ))}
                          </AnimatePresence>
                      )}
                  </div>
              </GlassPanel>

              {/* Right: Filters */}
              <div style={{ flex: 0.5, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '200px' }}>
                  
                  {/* Type Filters */}
                  <GlassPanel style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Filter size={16} /> Filter by Type
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {filterButtons.map(btn => (
                              <button
                                  key={btn.value}
                                  onClick={() => setFilterType(btn.value)}
                                  style={{
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: filterType === btn.value ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                                      color: filterType === btn.value ? '#000' : 'var(--color-text)',
                                      fontSize: '0.85rem',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      transition: 'all 0.2s'
                                  }}
                              >
                                  {btn.icon && <btn.icon size={14} />}
                                  {btn.label}
                                  <span style={{ 
                                      marginLeft: 'auto', 
                                      fontSize: '0.75rem', 
                                      opacity: 0.7,
                                      color: filterType === btn.value ? '#000' : 'var(--color-text-dim)'
                                  }}>
                                      {btn.value === 'all' ? logs.length : logs.filter(l => (l.type || '').includes(btn.value)).length}
                                  </span>
                              </button>
                          ))}
                      </div>
                  </GlassPanel>
                  
                  {/* Info Panel */}
                  <GlassPanel style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Quick Info</h3>
                      
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                          Showing activity from the last 30 days. Click on a user's name to view their VRChat profile.
                      </div>
                      
                      <div style={{ marginTop: 'auto', padding: '0.75rem', background: 'rgba(var(--primary-hue), 100%, 50%, 0.1)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Tip:</strong>
                          Use the search to find specific users or actions quickly.
                      </div>
                  </GlassPanel>
              </div>
          </div>
      </motion.div>
    </>
  );
};

// Simple time ago helper
const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const AuditLogCard: React.FC<{ log: AuditLogEntry; onUndo: (e: React.MouseEvent) => void }> = ({ log, onUndo }) => {
    const type = log.type || 'unknown';
    let icon = '📝';
    let color = 'var(--color-text-dim)';
    let canUndo = false;

    if (type.includes('ban')) {
        icon = '🚫';
        color = 'var(--color-danger)';
        canUndo = true;
    } else if (type.includes('kick')) {
        icon = '🥾';
        color = 'var(--color-warning)';
    } else if (type.includes('invite')) {
        icon = '📩';
        color = 'var(--color-success)';
    } else if (type.includes('automod')) {
        icon = '🤖';
        color = '#a855f7';
    } else if (type.includes('role')) {
        icon = '🔑';
        color = 'var(--color-info)';
    }

    const formatLogEntry = (logItem: AuditLogEntry) => {
      if (logItem.type === 'group.automod') {
          return { actor: logItem.actorDisplayName || 'AutoMod', description: logItem.description || 'Action performed' };
      }

      let actor = logItem.actorDisplayName;
      let desc = logItem.description;

      if (desc.endsWith(' by .')) {
          desc = desc.substring(0, desc.length - 5);
      }

      if (actor === 'UNKNOWN' && desc.match(/^\S+ User /)) {
           const parts = desc.split(' ');
           if (parts.length > 0) {
               actor = parts[0];
           }
      }

      let cleanDesc = desc;
      if (actor !== 'UNKNOWN' && actor) {
         cleanDesc = cleanDesc.replace(actor, '');
      }
      
      cleanDesc = cleanDesc.replace(/by \s*$/, '').trim();
      cleanDesc = cleanDesc.replace(/\s+/g, ' ');

      return { actor, description: cleanDesc };
    };

    const { actor, description } = formatLogEntry(log);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ 
                padding: '0.75rem 1rem', 
                display: 'flex', 
                gap: '1rem', 
                alignItems: 'center',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)'
            }}
        >
            <div style={{ 
                fontSize: '1.25rem', 
                width: '36px', 
                height: '36px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '50%',
                flexShrink: 0
            }}>
                {icon}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                    <span style={{ fontWeight: 600, color, fontSize: '0.85rem' }}>
                        {type.split('.').pop()?.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                        {timeAgo(log.created_at)}
                    </span>
                </div>
                
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span 
                        style={{ color: 'var(--color-primary)', cursor: log.actorId ? 'pointer' : 'default' }}
                        onClick={() => log.actorId && window.open(`https://vrchat.com/home/user/${log.actorId}`, '_blank')}
                        title={log.actorId ? "View VRChat Profile" : undefined}
                    >
                        {actor}
                    </span>
                    {' '}
                    {description}
                </div>
            </div>
            
            {canUndo && (
                <NeonButton size="sm" variant="danger" onClick={onUndo} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                    Unban
                </NeonButton>
            )}
        </motion.div>
    );
};
