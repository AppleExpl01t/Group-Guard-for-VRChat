import React, { useState, useEffect, useMemo } from 'react';
import { useConfirm } from '../../context/ConfirmationContext';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { NeonButton } from '../../components/ui/NeonButton';
import { Search, Plus, User, Users, Box, ShieldAlert, EyeOff, Edit, Trash, Tag, Filter, AlertTriangle, Settings } from 'lucide-react';
import { EntitySearchModal } from './dialogs/EntitySearchModal';
import { TagManagerDialog } from './dialogs/TagManagerDialog';
import { EntityDetailDialog } from './EntityDetailDialog';
import type { WatchedEntity, ModerationTag } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { StatTile } from '../dashboard/components/StatTile';
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

export const WatchlistView: React.FC = () => {
  const { confirm } = useConfirm();
  const [entities, setEntities] = useState<WatchedEntity[]>([]);
  const [tags, setTags] = useState<ModerationTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedDisplayName, setSelectedDisplayName] = useState<string>('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'user' | 'group' | 'avatar'>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  
  useEffect(() => {
    loadData();
    
    const cleanup = window.electron.watchlist?.onUpdate?.((data) => {
        setEntities(data.entities);
        setTags(data.tags);
    });
    return () => cleanup && cleanup();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [e, t] = await Promise.all([
          window.electron.watchlist.getEntities(),
          window.electron.watchlist.getTags()
      ]);
      setEntities(e);
      setTags(t);
    } catch (err) {
      console.error('Failed to load watchlist', err);
    } finally {
      setLoading(false);
    }
  };

  /* Hook usage moved to component body */
  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const confirmed = await confirm({
        title: 'Remove from Watchlist',
        message: 'Are you sure you want to remove this entity from the watchlist?',
        confirmLabel: 'Remove',
        variant: 'danger'
      });
      
      if (confirmed) {
          await window.electron.watchlist.deleteEntity(id);
      }
  };

  const handleEdit = (id: string, displayName?: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSelectedEntityId(id);
      setSelectedDisplayName(displayName || '');
      setIsDetailOpen(true);
  };

  const handleCreate = () => {
      setIsAddModalOpen(true);
  };
  
  const handleAddEntity = (id: string, displayName: string) => {
      if (id.trim()) {
          setIsAddModalOpen(false);
          handleEdit(id.trim(), displayName);
      }
  };

  const filteredEntities = useMemo(() => {
    return entities.filter(entity => {
      const matchesSearch = 
        entity.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        entity.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.notes.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === 'all' || entity.type === filterType;
      const matchesCritical = !showCriticalOnly || entity.critical;
      
      return matchesSearch && matchesType && matchesCritical;
    }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [entities, searchQuery, filterType, showCriticalOnly]);

  const getTagColor = (tagId: string) => {
      return tags.find(t => t.id === tagId)?.color || 'var(--color-primary)';
  };
  
  const getTagLabel = (tagId: string) => {
      return tags.find(t => t.id === tagId)?.label || tagId;
  };

  // Stats
  const criticalCount = entities.filter(e => e.critical).length;
  const userCount = entities.filter(e => e.type === 'user').length;
  const groupCount = entities.filter(e => e.type === 'group').length;

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
                      Watchlist
                  </h1>
                  <div className={styles.subtitle}>
                      ENTITY TRACKING SYSTEM
                  </div>
              </div>

              <div className={styles.statsGrid}>
                  <StatTile 
                      label="TOTAL ENTITIES"
                      value={entities.length}
                      color="var(--color-primary)"
                  />
                  <StatTile 
                      label="USERS"
                      value={userCount}
                      color="var(--color-info)"
                  />
                  <StatTile 
                      label="GROUPS"
                      value={groupCount}
                      color="var(--color-accent)"
                  />
                  <StatTile 
                      label="CRITICAL"
                      value={criticalCount}
                      color="var(--color-danger)"
                      headerRight={criticalCount > 0 ? <AlertTriangle size={14} className="text-red-500 animate-pulse" /> : undefined}
                  />
              </div>
          </GlassPanel>

          {/* Main Content Split */}
          <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
              
              {/* Left: Entity List */}
              <GlassPanel style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, flexShrink: 0 }}>Tracked Entities</h3>
                      
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
                              placeholder="Search..." 
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
                      
                      <NeonButton onClick={handleCreate} size="sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Plus size={16} /> Add
                      </NeonButton>
                  </div>
                  
                  {/* Table Header */}
                  <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 0.8fr 0.6fr 1.2fr 0.8fr 100px',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      color: 'var(--color-text-dim)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                  }}>
                      <div>Entity</div>
                      <div>Type</div>
                      <div>Priority</div>
                      <div>Tags</div>
                      <div>Flags</div>
                      <div style={{ textAlign: 'right' }}>Actions</div>
                  </div>

                  {/* Table Body */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                      {loading ? (
                          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-dim)' }}>
                              Loading watchlist...
                          </div>
                      ) : filteredEntities.length === 0 ? (
                          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '2rem' }}>📋</span>
                              <span>{searchQuery || filterType !== 'all' || showCriticalOnly ? 'No entities match your filters.' : 'No entities in watchlist.'}</span>
                              {!searchQuery && filterType === 'all' && !showCriticalOnly && (
                                  <NeonButton onClick={handleCreate} size="sm" variant="secondary" style={{ marginTop: '0.5rem' }}>
                                      <Plus size={14} /> Add Your First Entity
                                  </NeonButton>
                              )}
                          </div>
                      ) : (
                          <AnimatePresence>
                              {filteredEntities.map((entity) => (
                                  <motion.div 
                                      key={entity.id}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      onClick={() => handleEdit(entity.id, entity.displayName)}
                                      style={{
                                          display: 'grid',
                                          gridTemplateColumns: '2fr 0.8fr 0.6fr 1.2fr 0.8fr 100px',
                                          padding: '0.75rem 1rem',
                                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                                          cursor: 'pointer',
                                          transition: 'background 0.2s'
                                      }}
                                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                                  >
                                      {/* Entity Info */}
                                      <div>
                                          <div style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>{entity.displayName}</div>
                                          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', fontFamily: 'monospace' }}>
                                              {entity.id.substring(0, 30)}{entity.id.length > 30 ? '...' : ''}
                                          </div>
                                      </div>

                                      {/* Type */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>
                                          {entity.type === 'user' && <User size={14} />}
                                          {entity.type === 'group' && <Users size={14} />}
                                          {entity.type === 'avatar' && <Box size={14} />}
                                          <span style={{ textTransform: 'capitalize' }}>{entity.type}</span>
                                      </div>

                                      {/* Priority */}
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                          <span style={{ 
                                              fontFamily: 'monospace', 
                                              fontWeight: 700,
                                              fontSize: '0.85rem',
                                              color: entity.priority < 0 ? '#f87171' : entity.priority > 0 ? '#4ade80' : 'var(--color-text-dim)'
                                          }}>
                                              {entity.priority > 0 ? '+' : ''}{entity.priority}
                                          </span>
                                      </div>

                                      {/* Tags */}
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                                          {entity.tags.slice(0, 2).map(tagId => (
                                              <span 
                                                  key={tagId}
                                                  style={{
                                                      padding: '2px 6px',
                                                      borderRadius: '3px',
                                                      fontSize: '0.65rem',
                                                      fontWeight: 600,
                                                      background: getTagColor(tagId),
                                                      color: '#000'
                                                  }}
                                              >
                                                  {getTagLabel(tagId)}
                                              </span>
                                          ))}
                                          {entity.tags.length > 2 && (
                                              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>+{entity.tags.length - 2}</span>
                                          )}
                                      </div>

                                      {/* Flags */}
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          {entity.critical && (
                                              <div title="Critical: Always Alert">
                                                  <ShieldAlert size={16} style={{ color: '#ef4444' }} />
                                              </div>
                                          )}
                                          {entity.silent && (
                                              <div title="Silent: Log Only">
                                                  <EyeOff size={16} style={{ color: 'var(--color-text-dim)' }} />
                                              </div>
                                          )}
                                      </div>

                                      {/* Actions */}
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                          <NeonButton 
                                              size="sm" 
                                              variant="ghost" 
                                              onClick={(e) => handleEdit(entity.id, entity.displayName, e)}
                                              style={{ padding: '4px' }}
                                          >
                                              <Edit size={12} />
                                          </NeonButton>
                                          <NeonButton 
                                              size="sm" 
                                              variant="danger" 
                                              onClick={(e) => handleDelete(entity.id, e)}
                                              style={{ padding: '4px' }}
                                          >
                                              <Trash size={12} />
                                          </NeonButton>
                                      </div>
                                  </motion.div>
                              ))}
                          </AnimatePresence>
                      )}
                  </div>
              </GlassPanel>

              {/* Right: Filters & Info */}
              <div style={{ flex: 0.6, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '220px' }}>
                  
                  {/* Filters */}
                  <GlassPanel style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Filter size={16} /> Filters
                      </h3>
                      
                      {/* Type Filter */}
                      <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entity Type</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(['all', 'user', 'group', 'avatar'] as const).map(type => (
                                  <button
                                      key={type}
                                      onClick={() => setFilterType(type)}
                                      style={{
                                          padding: '4px 10px',
                                          borderRadius: '4px',
                                          border: 'none',
                                          background: filterType === type ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                          color: filterType === type ? '#000' : 'var(--color-text-dim)',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          textTransform: 'capitalize'
                                      }}
                                  >
                                      {type}
                                  </button>
                              ))}
                          </div>
                      </div>
                      
                      {/* Critical Toggle */}
                      <div 
                          onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                          style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              background: showCriticalOnly ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.2)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: showCriticalOnly ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent'
                          }}
                      >
                          <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ShieldAlert size={14} style={{ color: '#ef4444' }} /> Critical Only
                          </span>
                          <div style={{
                              width: '36px',
                              height: '20px',
                              background: showCriticalOnly ? '#ef4444' : 'rgba(255,255,255,0.1)',
                              borderRadius: '10px',
                              position: 'relative',
                              transition: 'background 0.2s'
                          }}>
                              <div style={{
                                  width: '16px',
                                  height: '16px',
                                  background: 'white',
                                  borderRadius: '50%',
                                  position: 'absolute',
                                  top: '2px',
                                  left: showCriticalOnly ? '18px' : '2px',
                                  transition: 'left 0.2s'
                              }} />
                          </div>
                      </div>
                  </GlassPanel>
                  
                  {/* Tags Panel */}
                  <GlassPanel style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Tag size={16} /> Tags</span>
                          <NeonButton size="sm" variant="ghost" onClick={() => setIsTagManagerOpen(true)} style={{ padding: '2px 6px' }} title="Manage Tags">
                              <Settings size={14} />
                          </NeonButton>
                      </h3>
                      
                      {tags.length === 0 ? (
                          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>
                              No tags defined yet.
                          </div>
                      ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {tags.map(tag => (
                                  <div 
                                      key={tag.id}
                                      style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '6px 8px',
                                          background: 'rgba(0,0,0,0.2)',
                                          borderRadius: '4px'
                                      }}
                                  >
                                      <div style={{
                                          width: '12px',
                                          height: '12px',
                                          borderRadius: '50%',
                                          background: tag.color
                                      }} />
                                      <span style={{ fontSize: '0.85rem', flex: 1 }}>{tag.label}</span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                                          {entities.filter(e => e.tags.includes(tag.id)).length}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      )}
                      
                      <div style={{ marginTop: 'auto', padding: '0.75rem', background: 'rgba(var(--primary-hue), 100%, 50%, 0.1)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Tip:</strong>
                          Use tags to categorize entities for quick filtering.
                      </div>
                  </GlassPanel>
              </div>
          </div>
      </motion.div>

      {/* Modals */}
      <EntitySearchModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={(id, displayName) => handleAddEntity(id, displayName)}
      />

      <TagManagerDialog 
        open={isTagManagerOpen} 
        onOpenChange={setIsTagManagerOpen} 
        tags={tags}
        onTagsChanged={loadData}
      />

      <EntityDetailDialog 
        open={isDetailOpen} 
        onOpenChange={setIsDetailOpen}
        entityId={selectedEntityId || ''}
        initialDisplayName={selectedDisplayName}
        onSave={loadData}
      />
    </>
  );
};
