import React, { useEffect, useState, useCallback } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { RuleCard } from '../automod/components/RuleCard';
import { NeonButton } from '../../components/ui/NeonButton';
import { Shield, UserMinus, Plus, RefreshCw, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


// Use inline styles or reuse Dashboard styles if possible. 
// Since we can't easily import module css from elsewhere without types sometimes, 
// we'll use inline styles for container to match InstanceGuardView pattern.

interface StaffMember {
    id: string;
    name: string;
    rules: string[];
}

interface StaffSettings {
    skipAutoModScans: boolean;
    preventKicks: boolean;
    preventBans: boolean;
    allowAllInstances: boolean;
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

export const StaffView: React.FC = () => {
    const { selectedGroup } = useGroupStore();
    const [members, setMembers] = useState<StaffMember[]>([]);
    const [settings, setSettings] = useState<StaffSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [newUserId, setNewUserId] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    const loadData = useCallback(async () => {
        if (!selectedGroup) return;
        setLoading(true);
        try {
            const [m, s] = await Promise.all([
                window.electron.staff.getMembers(selectedGroup.id),
                window.electron.staff.getSettings(selectedGroup.id)
            ]);
            setMembers(m);
            setSettings(s as StaffSettings);
        } catch (e) {
            console.error("Failed to load staff data", e);
        } finally {
            setLoading(false);
        }
    }, [selectedGroup]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSettingsChange = async (key: keyof StaffSettings) => {
        if (!selectedGroup || !settings) return;

        const newValue = !settings[key];
        // Optimistic update
        const previousSettings = { ...settings };
        setSettings({ ...settings, [key]: newValue });

        try {
            console.log(`[Staff] Updating settings for group: ${selectedGroup.id}`, { ...settings, [key]: newValue });
            const result = await window.electron.staff.setSettings(selectedGroup.id, { [key]: newValue });

            console.log('[Staff] setSettings result:', result);

            // Correct check for object response { success: true }
            if (!result || (typeof result === 'object' && !result.success)) {
                throw new Error("Failed to save settings");
            }
        } catch (e) {
            console.error("Failed to update settings:", e);
            setSettings(previousSettings); // Revert
        }
    };

    const handleAddMember = async () => {
        if (!selectedGroup || !newUserId) return;
        setAddLoading(true);
        try {
            const result = await window.electron.staff.addMember(selectedGroup.id, newUserId);
            if (!result.success) {
                throw new Error(result.error || "Failed to add member");
            }
            setNewUserId('');
            loadData();
        } catch (e) {
            console.error("Failed to add member", e);
        } finally {
            setAddLoading(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!selectedGroup) return;
        if (!confirm('Are you sure you want to remove this staff member?')) return;

        try {
            const result = await window.electron.staff.removeMember(selectedGroup.id, userId);
            if (!result.success) {
                throw new Error(result.error || "Failed to remove member");
            }
            loadData();
        } catch (e) {
            console.error("Failed to remove member", e);
        }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                gap: '1rem',
                padding: '1rem',
                paddingBottom: 'var(--dock-height)'
            }}
        >
            {!selectedGroup && (
                <div style={{ padding: '1rem', background: 'rgba(255,165,0, 0.2)', border: '1px solid orange', borderRadius: '8px', color: '#ffcc00' }}>
                    Please select a group to manage staff.
                </div>
            )}

            {/* Header */}
            <GlassPanel style={{ flexShrink: 0, padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="text-gradient" style={{ fontSize: '2rem', margin: 0 }}>Staff Management</h1>
                    <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '1px' }}>
                        PROTECTION & ACCESS CONTROL
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'white' }}>{members.length}</div>
                    <div style={{ color: 'var(--color-text-dim)', fontSize: '0.8rem' }}>ACTIVE STAFF</div>
                </div>
            </GlassPanel>

            <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>

                {/* Left: Staff List */}
                <GlassPanel style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Staff Team</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="Add User ID (usr_...)"
                                value={newUserId}
                                onChange={(e) => setNewUserId(e.target.value)}
                                style={{
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    width: '200px'
                                }}
                            />
                            <NeonButton size="sm" onClick={handleAddMember} disabled={!newUserId || addLoading}>
                                <Plus size={16} style={{ marginRight: '4px' }} />
                                Add
                            </NeonButton>
                            <NeonButton variant="ghost" size="sm" onClick={loadData} disabled={loading}>
                                <RefreshCw size={16} />
                            </NeonButton>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <AnimatePresence>
                            {members.map(member => (
                                <motion.div
                                    key={member.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'black'
                                        }}>
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'white' }}>{member.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>{member.id}</div>
                                        </div>
                                    </div>
                                    <NeonButton variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)} style={{ color: 'var(--color-danger)' }}>
                                        <UserMinus size={16} />
                                    </NeonButton>
                                </motion.div>
                            ))}
                            {members.length === 0 && !loading && (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-dim)' }}>
                                    No staff members found. Add users to the AutoMod whitelist to give them staff status.
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </GlassPanel>

                {/* Right: Settings */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <GlassPanel style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Protection Levels</h3>

                        {settings && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <RuleCard
                                    title="Skip AutoMod Scans"
                                    description="Staff members will not be scanned by AutoMod."
                                    statusLabel={settings.skipAutoModScans ? 'ON' : 'OFF'}
                                    isEnabled={settings.skipAutoModScans}
                                    onToggle={() => handleSettingsChange('skipAutoModScans')}
                                    icon={<Shield size={20} />}
                                    color="var(--color-success)"
                                />
                                <RuleCard
                                    title="Prevent Kicks"
                                    description="Prevent staff from being kicked by the bot."
                                    statusLabel={settings.preventKicks ? 'ON' : 'OFF'}
                                    isEnabled={settings.preventKicks}
                                    onToggle={() => handleSettingsChange('preventKicks')}
                                    icon={<Shield size={20} />}
                                    color="var(--color-info)"
                                />
                                <RuleCard
                                    title="Prevent Bans"
                                    description="Prevent staff from being banned by the bot."
                                    statusLabel={settings.preventBans ? 'ON' : 'OFF'}
                                    isEnabled={settings.preventBans}
                                    onToggle={() => handleSettingsChange('preventBans')}
                                    icon={<Shield size={20} />}
                                    color="var(--color-warning)"
                                />
                                <RuleCard
                                    title="Allow All Instances"
                                    description="Staff can enter closed/restricted instances."
                                    statusLabel={settings.allowAllInstances ? 'ON' : 'OFF'}
                                    isEnabled={settings.allowAllInstances}
                                    onToggle={() => handleSettingsChange('allowAllInstances')}
                                    icon={<Shield size={20} />}
                                    color="var(--color-primary)"
                                />
                            </div>
                        )}
                        {!settings && loading && <div>Loading settings...</div>}
                    </GlassPanel>
                </div>

            </div>
        </motion.div>
    );
};
