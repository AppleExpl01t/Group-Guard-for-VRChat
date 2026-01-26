import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { NeonButton } from '../../components/ui/NeonButton';
import { Save, ShieldAlert, EyeOff, FileText, User, Users, Box } from 'lucide-react';
import { ReportGeneratorDialog } from '../reports/ReportGeneratorDialog';

import type { WatchedEntity, ModerationTag } from './types';

export type { WatchedEntity, ModerationTag };

interface EntityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  initialDisplayName?: string;
  onSave: () => void;
}

export const EntityDetailDialog: React.FC<EntityDetailDialogProps> = ({
  open, onOpenChange, entityId, initialDisplayName, onSave
}) => {
  const [entity, setEntity] = useState<Partial<WatchedEntity>>({
    id: entityId,
    displayName: initialDisplayName || '',
    tags: [],
    notes: '',
    priority: 0,
    critical: false,
    silent: false,
    type: entityId.startsWith('grp_') ? 'group' : 'user'
  });
  
  const [availableTags, setAvailableTags] = useState<ModerationTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedEntity, tags] = await Promise.all([
        window.electron.watchlist.getEntity(entityId),
        window.electron.watchlist.getTags()
      ]);
      
      setAvailableTags(tags);
      
      if (fetchedEntity) {
        setEntity(fetchedEntity);
      } else {
        setEntity({
            id: entityId,
            displayName: initialDisplayName || '',
            tags: [],
            notes: '',
            priority: 0,
            critical: false,
            silent: false,
            type: entityId.startsWith('grp_') ? 'group' : 'user'
        });
      }
    } catch (e) {
      console.error('Failed to load watchlist data', e);
    } finally {
      setLoading(false);
    }
  }, [entityId, initialDisplayName]);

  useEffect(() => {
    if (open && entityId) {
      loadData();
    }
  }, [open, entityId, loadData]);

  const handleSave = async () => {
    try {
      await window.electron.watchlist.saveEntity(entity as WatchedEntity);
      onSave();
      onOpenChange(false);
    } catch (e) {
      console.error('Failed to save', e);
    }
  };

  const toggleTag = (tagId: string) => {
    const currentTags = entity.tags || [];
    if (currentTags.includes(tagId)) {
      setEntity({ ...entity, tags: currentTags.filter(t => t !== tagId) });
    } else {
      setEntity({ ...entity, tags: [...currentTags, tagId] });
    }
  };

  const getTypeIcon = () => {
    switch (entity.type) {
      case 'user': return <User size={20} />;
      case 'group': return <Users size={20} />;
      case 'avatar': return <Box size={20} />;
      default: return <User size={20} />;
    }
  };

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'white',
    fontSize: '0.9rem',
    outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--color-text-dim)',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    display: 'block'
  };

  return (
    <>
      <Modal 
        isOpen={open} 
        onClose={() => onOpenChange(false)}
        title={`Edit Watchlist Entry`}
        width="700px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Entity Header */}
          <GlassPanel style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(var(--primary-hue), 100%, 50%, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              {getTypeIcon()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>
                {entity.displayName || 'New Entity'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontFamily: 'monospace' }}>
                {entityId}
              </div>
            </div>
            <NeonButton 
              variant="ghost" 
              size="sm"
              onClick={() => setIsReportOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={16} /> Report
            </NeonButton>
          </GlassPanel>

          {/* Form Fields */}
          <div style={{ display: 'grid', gap: '1rem' }}>
            
            {/* Display Name */}
            <div>
              <label style={labelStyle}>Display Name</label>
              <input 
                type="text"
                value={entity.displayName || ''} 
                onChange={(e) => setEntity({...entity, displayName: e.target.value})}
                style={inputStyle}
                placeholder="Enter display name..."
              />
            </div>

            {/* Priority */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', alignItems: 'center' }}>
              <div>
                <label style={labelStyle}>Priority Score</label>
                <input 
                  type="number" 
                  value={entity.priority} 
                  onChange={(e) => setEntity({...entity, priority: parseInt(e.target.value) || 0})}
                  style={{ ...inputStyle, width: '100px' }}
                />
              </div>
              <div style={{ 
                padding: '0.75rem 1rem', 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: 'var(--color-text-dim)'
              }}>
                <strong style={{ color: '#f87171' }}>-10 or lower</strong>: Auto-Ban<br/>
                <strong style={{ color: '#4ade80' }}>+10 or higher</strong>: Auto-Trust
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {availableTags.map(tag => {
                  const isSelected = entity.tags?.includes(tag.id);
                  return (
                    <button 
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.2)',
                        background: isSelected ? tag.color || 'var(--color-primary)' : 'transparent',
                        color: isSelected ? '#000' : 'white',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                    >
                      {tag.label}
                    </button>
                  );
                })}
                {availableTags.length === 0 && (
                  <span style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    No tags defined yet.
                  </span>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea 
                value={entity.notes} 
                onChange={(e) => setEntity({...entity, notes: e.target.value})}
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                placeholder="Private notes about this entity..."
              />
            </div>

            {/* Flags */}
            <div>
              <label style={labelStyle}>Flags</label>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  cursor: 'pointer',
                  padding: '0.75rem 1rem',
                  background: entity.critical ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)',
                  border: entity.critical ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}>
                  <input 
                    type="checkbox" 
                    checked={entity.critical || false} 
                    onChange={(e) => setEntity({...entity, critical: e.target.checked})}
                    style={{ display: 'none' }}
                  />
                  <ShieldAlert size={18} style={{ color: entity.critical ? '#ef4444' : 'var(--color-text-dim)' }} />
                  <span style={{ color: entity.critical ? '#fca5a5' : 'var(--color-text-dim)' }}>
                    Critical (Always Alert)
                  </span>
                </label>
                
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  cursor: 'pointer',
                  padding: '0.75rem 1rem',
                  background: entity.silent ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                  border: entity.silent ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}>
                  <input 
                    type="checkbox" 
                    checked={entity.silent || false} 
                    onChange={(e) => setEntity({...entity, silent: e.target.checked})}
                    style={{ display: 'none' }}
                  />
                  <EyeOff size={18} style={{ color: entity.silent ? 'white' : 'var(--color-text-dim)' }} />
                  <span style={{ color: entity.silent ? 'white' : 'var(--color-text-dim)' }}>
                    Silent (Log Only)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
            <NeonButton variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </NeonButton>
            <NeonButton onClick={handleSave} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} /> Save Changes
            </NeonButton>
          </div>
        </div>
      </Modal>
      
      <ReportGeneratorDialog 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        context={{
            target: { 
                displayName: entity.displayName || 'Unknown', 
                id: entity.id 
            },
            notes: entity.notes,
            reason: entity.tags?.join(', ') || 'Watchlist Entry',
            timestamp: new Date().toISOString()
        }}
      />
    </>
  );
};
