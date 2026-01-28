import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { NeonButton } from '../../../components/ui/NeonButton';
import { ShieldCheck, User, Users, RefreshCw, Trash2, Search, X } from 'lucide-react';
import { UserActionModal } from './UserActionModal';
import { useGroupStore } from '../../../stores/groupStore';

interface WhitelistEntity {
    id: string;
    name: string;
    rules: string[];
}

interface WhitelistViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const WhitelistViewerModal: React.FC<WhitelistViewerModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
    const [users, setUsers] = useState<WhitelistEntity[]>([]);
    const [groups, setGroups] = useState<WhitelistEntity[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // User Action Modal State
    const [selectedEntity, setSelectedEntity] = useState<WhitelistEntity | null>(null);
    const [showActionModal, setShowActionModal] = useState(false);

    const { selectedGroup } = useGroupStore();

    const loadWhitelist = async () => {
        if (!selectedGroup) return;

        setIsLoading(true);
        try {
            const data = await window.electron.automod.getWhitelistedEntities(selectedGroup.id);
            setUsers(data.users);
            setGroups(data.groups);
        } catch (error) {
            console.error("Failed to load whitelist:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && selectedGroup) {
            loadWhitelist();
        }
    }, [isOpen, selectedGroup]);

    const handleRemove = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedGroup) return;

        if (confirm('Are you sure you want to remove this entity from all whitelists?')) {
            try {
                await window.electron.automod.removeFromWhitelist(selectedGroup.id, id, activeTab === 'users' ? 'user' : 'group');
                // Optimistic update
                if (activeTab === 'users') {
                    setUsers(prev => prev.filter(u => u.id !== id));
                } else {
                    setGroups(prev => prev.filter(g => g.id !== id));
                }
            } catch (error) {
                console.error("Failed to remove from whitelist:", error);
            }
        }
    };

    const handleItemClick = (item: WhitelistEntity) => {
        if (activeTab === 'users') {
            setSelectedEntity(item);
            setShowActionModal(true);
        }
    };

    const currentList = activeTab === 'users' ? users : groups;
    const filteredList = currentList
        .filter(item => item && item.id) // Filter out nulls or empty IDs
        .filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.id.toLowerCase().includes(searchQuery.toLowerCase())
        );

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingBottom: '50px'
                    }}
                >
                    <motion.div
                        key="modal-content"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '90%',
                            maxWidth: '700px',
                            maxHeight: '80vh',
                            zIndex: 101,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            borderRadius: '12px'
                        }}
                    >
                        <GlassPanel style={{
                            padding: '0',
                            border: '1px solid rgba(74, 222, 128, 0.3)', // Green tint for whitelist
                            boxShadow: '0 0 30px rgba(74, 222, 128, 0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            maxHeight: '100%',
                            minHeight: 0
                        }}>
                            {!selectedGroup && (
                                <div style={{ padding: '0.75rem', background: 'rgba(234, 179, 8, 0.1)', borderBottom: '1px solid rgba(234, 179, 8, 0.2)', color: '#fbbf24', textAlign: 'center', fontSize: '0.9rem' }}>
                                    ⚠️ No Group Selected. Please select a group to view its whitelist.
                                </div>
                            )}

                            {/* Header */}
                            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '8px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '50%', color: '#4ade80' }}>
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div>
                                        Whitelist Manager
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', fontWeight: 'normal', marginTop: '2px' }}>
                                            Manage exceptions to AutoMod rules
                                        </div>
                                    </div>
                                </h2>
                                <button
                                    onClick={onClose}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: '1.5rem', display: 'flex' }}
                                >
                                    <X size={24} />
                                </button>
                            </div>



                            {/* Toolbar */}
                            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.1)' }}>
                                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
                                    <NeonButton
                                        variant={activeTab === 'users' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => setActiveTab('users')}
                                        glow={activeTab === 'users'}
                                        style={{ gap: '8px' }}
                                    >
                                        <User size={14} />
                                        Users
                                        <span style={{ fontSize: '0.75rem', opacity: 0.7, background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '10px', marginLeft: '4px' }}>{users.length}</span>
                                    </NeonButton>
                                    <NeonButton
                                        variant={activeTab === 'groups' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => setActiveTab('groups')}
                                        glow={activeTab === 'groups'}
                                        style={{ gap: '8px' }}
                                    >
                                        <Users size={14} />
                                        Groups
                                        <span style={{ fontSize: '0.75rem', opacity: 0.7, background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '10px', marginLeft: '4px' }}>{groups.length}</span>
                                    </NeonButton>
                                </div>

                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                                    <input
                                        type="text"
                                        placeholder={`Search ${activeTab}...`}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%', padding: '8px 8px 8px 36px', borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                                            color: 'white', fontSize: '0.9rem', outline: 'none'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'rgba(74, 222, 128, 0.4)'}
                                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                    />
                                </div>
                                <NeonButton variant="ghost" size="sm" onClick={loadWhitelist} disabled={isLoading} title="Refresh">
                                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                                </NeonButton>
                            </div>

                            {/* List Content */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {isLoading && filteredList.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'rgba(255,255,255,0.4)', gap: '1rem' }}>
                                        <RefreshCw className="animate-spin" size={24} />
                                        Loading whitelist data...
                                    </div>
                                ) : filteredList.length > 0 ? (
                                    filteredList.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleItemClick(item)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                cursor: activeTab === 'users' ? 'pointer' : 'default',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => {
                                                if (activeTab === 'users') {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (activeTab === 'users') {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                                }
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: activeTab === 'users' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                                                    color: activeTab === 'users' ? '#60a5fa' : '#c084fc',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {activeTab === 'users' ? <User size={16} /> : <Users size={16} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                                                        <code style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>
                                                            {item.id}
                                                        </code>
                                                        {item.rules.length > 0 && (
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                {item.rules.map(rule => (
                                                                    <span key={rule} style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                                                                        {rule}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <NeonButton
                                                onClick={(e) => handleRemove(item.id, e)}
                                                variant="danger"
                                                size="sm"
                                                glow={false}
                                                style={{ padding: '8px', height: 'auto', minWidth: 'auto' }}
                                                title="Remove from whitelist"
                                            >
                                                <Trash2 size={16} />
                                            </NeonButton>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ padding: '1.5rem', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                            <ShieldCheck size={32} />
                                        </div>
                                        <div>
                                            {searchQuery ? `No matches found for "${searchQuery}"` : `No whitelisted ${activeTab} yet.`}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sticky Footer */}
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                                <NeonButton
                                    onClick={onClose}
                                    variant="primary"
                                    size="md"
                                    glow
                                >
                                    Done
                                </NeonButton>
                            </div>

                        </GlassPanel>
                    </motion.div>
                </motion.div>
            )}

            {showActionModal && selectedEntity && (
                <UserActionModal
                    isOpen={showActionModal}
                    onClose={() => setShowActionModal(false)}
                    logEntry={{
                        userId: selectedEntity.id,
                        user: selectedEntity.name,
                        action: 'WHITELISTED',
                        reason: `Whitelisted on: ${selectedEntity.rules.join(', ')}`,
                        timestamp: undefined,
                        groupId: undefined
                    }}
                    onActionComplete={() => {
                        loadWhitelist();
                    }}
                />
            )}
        </AnimatePresence>,
        document.body
    );
};
