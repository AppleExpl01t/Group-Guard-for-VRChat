import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { NeonButton } from '../../../components/ui/NeonButton';
import { Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '../../../context/ConfirmationContext';
import { useNotificationStore } from '../../../stores/notificationStore';
import type { ModerationTag } from '../types';

interface TagManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tags: ModerationTag[];
    onTagsChanged: () => void;
}

const PRESET_COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#d946ef', // Fuchsia
    '#f43f5e', // Rose
    '#64748b', // Slate
];

export const TagManagerDialog: React.FC<TagManagerDialogProps> = ({ 
    open, 
    onOpenChange, 
    tags, 
    onTagsChanged 
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<ModerationTag>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [createForm, setCreateForm] = useState<Partial<ModerationTag>>({
        color: PRESET_COLORS[5]
    });
    
    const { confirm } = useConfirm();
    const { addNotification } = useNotificationStore();

    const handleStartEdit = (tag: ModerationTag) => {
        setEditingId(tag.id);
        setEditForm({ ...tag });
        setIsCreating(false);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editForm.label) return;
        
        // Ensure ID is consistent (though usually ID doesn't change)
        // Backend expects 'description' to be a string, so we default to empty string
        const updatedTag = {
            id: editingId,
            label: editForm.label,
            description: editForm.description || '',
            color: editForm.color || '#ffffff'
        };

        try {
            await window.electron.watchlist.saveTag(updatedTag);
            onTagsChanged();
            setEditingId(null);
            addNotification({
                type: 'success',
                title: 'Tag Saved',
                message: 'Tag updated successfully.'
            });
        } catch (error) {
            console.error('Failed to save tag', error);
            addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to save tag changes.'
            });
        }
    };

    const handleDelete = async (tagId: string) => {
        const confirmed = await confirm({
            title: 'Delete Tag',
            message: 'Are you sure? This will remove this tag from all entities.',
            confirmLabel: 'Delete',
            variant: 'danger'
        });

        if (!confirmed) return;
        
        try {
            await window.electron.watchlist.deleteTag(tagId);
            onTagsChanged();
            addNotification({
                type: 'success',
                title: 'Tag Deleted',
                message: 'Tag removed successfully.'
            });
        } catch (error) {
            console.error('Failed to delete tag', error);
            addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to delete tag.'
            });
        }
    };

    const handleCreate = async () => {
        if (!createForm.label) return;

        // Generate ID from label if not provided
        const id = createForm.id || createForm.label.toLowerCase().replace(/\s+/g, '-');
        
        const newTag = {
            id,
            label: createForm.label,
            description: createForm.description || '',
            color: createForm.color || PRESET_COLORS[5]
        };

        try {
            await window.electron.watchlist.saveTag(newTag);
            onTagsChanged();
            setIsCreating(false);
            setCreateForm({ color: PRESET_COLORS[5] });
            addNotification({
                type: 'success',
                title: 'Tag Created',
                message: 'New tag added.'
            });
        } catch (error) {
            console.error('Failed to create tag', error);
            addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to create tag.'
            });
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={() => onOpenChange(false)}
            title="Manage Tags"
            width="600px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '400px', maxHeight: '600px' }}>
                
                {/* Tag List */}
                <GlassPanel style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tags.map(tag => {
                        const isEditing = editingId === tag.id;
                        
                        if (isEditing) {
                            return (
                                <div key={tag.id} style={{ 
                                    padding: '0.75rem', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            value={editForm.label || ''}
                                            onChange={e => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                                            placeholder="Tag Name"
                                            style={{
                                                flex: 1,
                                                padding: '6px 10px',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '4px',
                                                color: 'white',
                                                fontSize: '0.9rem'
                                            }}
                                        />
                                        <input
                                            type="color"
                                            value={editForm.color}
                                            onChange={e => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                                            style={{ width: '40px', height: '32px', padding: 0, border: 'none', background: 'transparent' }}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={editForm.description || ''}
                                        onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Description (optional)"
                                        style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '4px',
                                            color: 'var(--color-text-secondary)',
                                            fontSize: '0.8rem'
                                        }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                        <NeonButton size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</NeonButton>
                                        <NeonButton size="sm" variant="primary" onClick={handleSaveEdit}>Save</NeonButton>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={tag.id} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '0.5rem 0.75rem',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '6px',
                                border: '1px solid transparent',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: tag.color || '#fff' }} />
                                    <div>
                                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{tag.label}</div>
                                        {tag.description && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>{tag.description}</div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <NeonButton size="sm" variant="ghost" onClick={() => handleStartEdit(tag)} style={{ padding: '4px 8px' }}>
                                        Edit
                                    </NeonButton>
                                    <NeonButton size="sm" variant="danger" onClick={() => handleDelete(tag.id)} style={{ padding: '4px 8px' }}>
                                        <Trash2 size={14} />
                                    </NeonButton>
                                </div>
                            </div>
                        );
                    })}
                </GlassPanel>

                {/* Create New Section */}
                {isCreating ? (
                    <GlassPanel style={{ padding: '1rem', border: '1px solid var(--color-primary)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-primary)' }}>New Tag</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                             <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={createForm.label || ''}
                                    onChange={e => setCreateForm(prev => ({ ...prev, label: e.target.value }))}
                                    placeholder="Tag Name"
                                    autoFocus
                                    style={{
                                        flex: 1,
                                        padding: '8px 10px',
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        color: 'white'
                                    }}
                                />
                                <input
                                    type="color"
                                    value={createForm.color}
                                    onChange={e => setCreateForm(prev => ({ ...prev, color: e.target.value }))}
                                    style={{ width: '40px', height: '38px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                />
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {PRESET_COLORS.map(c => (
                                    <div 
                                        key={c}
                                        onClick={() => setCreateForm(prev => ({ ...prev, color: c }))}
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            background: c,
                                            cursor: 'pointer',
                                            border: createForm.color === c ? '2px solid white' : '2px solid transparent',
                                            boxShadow: createForm.color === c ? '0 0 4px rgba(0,0,0,0.5)' : 'none'
                                        }}
                                    />
                                ))}
                            </div>

                            <input
                                type="text"
                                value={createForm.description || ''}
                                onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Description (optional)"
                                style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '4px',
                                    color: 'var(--color-text-secondary)'
                                }}
                            />
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <NeonButton variant="ghost" onClick={() => setIsCreating(false)}>Cancel</NeonButton>
                                <NeonButton variant="primary" onClick={handleCreate} disabled={!createForm.label}>Create Tag</NeonButton>
                            </div>
                        </div>
                    </GlassPanel>
                ) : (
                    <NeonButton 
                        variant="secondary" 
                        onClick={() => { setIsCreating(true); setEditingId(null); setCreateForm({ color: PRESET_COLORS[5] }); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '1rem' }}
                    >
                        <Plus size={18} /> Create New Tag
                    </NeonButton>
                )}
            </div>
        </Modal>
    );
};
