import React, { useEffect, useState, useCallback } from 'react';
import { NeonButton } from '../../components/ui/NeonButton';
import type { DiscordRpcConfig } from '../../types/electron';

// Inner card style for settings sections (used inside main GlassPanel)
const innerCardStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '12px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.05)',
};

export const DiscordRpcSettings: React.FC = () => {
    const [config, setConfig] = useState<DiscordRpcConfig>({
        enabled: true,
        showGroupName: true,
        showMemberCount: true,
        showElapsedTime: true,
        customDetails: '',
        customState: ''
    });
    const [status, setStatus] = useState<{ connected: boolean; enabled: boolean }>({ connected: false, enabled: true });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string>('');

    const loadConfig = useCallback(async () => {
        try {
            if (!window.electron?.discordRpc) return;
            const current = await window.electron.discordRpc.getConfig();
            if (current) setConfig(current);
        } catch (err) {
            console.error('Failed to load Discord RPC config:', err);
        }
    }, []);

    const loadStatus = useCallback(async () => {
        try {
            if (!window.electron?.discordRpc) return;
            const s = await window.electron.discordRpc.getStatus();
            setStatus(s);
        } catch (err) {
            console.error('Failed to load Discord RPC status:', err);
        }
    }, []);

    useEffect(() => {
        loadConfig();
        loadStatus();
    }, [loadConfig, loadStatus]);

    const handleSave = async () => {
        setLoading(true);
        try {
            if (!window.electron?.discordRpc) throw new Error('Discord RPC API not available');
            await window.electron.discordRpc.setConfig(config);
            await loadStatus();
            setMessage('Saved!');
            setTimeout(() => setMessage(''), 2000);
        } catch (err) {
            console.error(err);
            setMessage('Error saving');
        }
        setLoading(false);
    };

    const handleReconnect = async () => {
        setLoading(true);
        setMessage('Reconnecting...');
        try {
            if (!window.electron?.discordRpc) throw new Error('Discord RPC API not available');
            const result = await window.electron.discordRpc.reconnect();
            if (result.success) {
                setMessage('Reconnected!');
                await loadStatus();
            } else {
                setMessage(result.error || 'Reconnect failed');
            }
        } catch {
            setMessage('Reconnect failed');
        }
        setTimeout(() => setMessage(''), 3000);
        setLoading(false);
    };

    // Toggle component for settings
    const Toggle = ({ value, onChange, label, description }: { value: boolean; onChange: () => void; label: string; description?: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
            <div>
                <div style={{ color: 'white', fontWeight: 600 }}>{label}</div>
                {description && <div style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>{description}</div>}
            </div>
            <div 
                onClick={onChange}
                style={{
                    width: '50px',
                    height: '26px',
                    background: value ? 'var(--color-success)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '13px',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.3s ease',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                <div style={{
                    width: '20px',
                    height: '20px',
                    background: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: value ? '26px' : '2px',
                    transition: 'left 0.3s ease',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }} />
            </div>
        </div>
    );

    return (
        <section>
            <h2 style={{ color: 'white', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Discord Rich Presence
            </h2>
            <div style={innerCardStyle}>
                <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                    
                    {/* Connection Status */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        padding: '0.75rem', 
                        background: 'rgba(0,0,0,0.2)', 
                        borderRadius: '8px',
                        border: `1px solid ${status.connected ? 'var(--color-success)' : 'rgba(255,255,255,0.1)'}`
                    }}>
                        <div style={{ 
                            width: '10px', 
                            height: '10px', 
                            borderRadius: '50%', 
                            background: status.connected ? 'var(--color-success)' : 'var(--color-error)',
                            boxShadow: status.connected ? '0 0 8px var(--color-success)' : 'none'
                        }} />
                        <span style={{ color: 'white', fontWeight: 500 }}>
                            {status.connected ? 'Connected to Discord' : 'Not Connected'}
                        </span>
                        {!status.connected && config.enabled && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                                (Is Discord running?)
                            </span>
                        )}
                    </div>

                    {/* Main Enable Toggle */}
                    <Toggle 
                        value={config.enabled}
                        onChange={() => setConfig({ ...config, enabled: !config.enabled })}
                        label="Enable Discord RPC"
                        description="Show your VRChat Group Guard activity on your Discord profile"
                    />

                    {/* Display Options */}
                    {config.enabled && (
                        <div style={{ 
                            padding: '1rem', 
                            background: 'rgba(0,0,0,0.15)', 
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Display Options
                            </div>
                            
                            <Toggle 
                                value={config.showGroupName}
                                onChange={() => setConfig({ ...config, showGroupName: !config.showGroupName })}
                                label="Show Group Name"
                                description="Display the name of the group you're guarding"
                            />
                            
                            <Toggle 
                                value={config.showMemberCount}
                                onChange={() => setConfig({ ...config, showMemberCount: !config.showMemberCount })}
                                label="Show Member Count"
                                description="Display the number of players in your current instance"
                            />
                            
                            <Toggle 
                                value={config.showElapsedTime}
                                onChange={() => setConfig({ ...config, showElapsedTime: !config.showElapsedTime })}
                                label="Show Elapsed Time"
                                description="Display how long Group Guard has been running"
                            />
                        </div>
                    )}

                    {/* Custom Text */}
                    {config.enabled && (
                        <div style={{ 
                            padding: '1rem', 
                            background: 'rgba(0,0,0,0.15)', 
                            borderRadius: '8px' 
                        }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-text-dim)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Custom Status Text (Optional)
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', color: 'var(--color-text-dim)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                        Details (Line 1)
                                    </label>
                                    <input 
                                        type="text"
                                        value={config.customDetails}
                                        onChange={(e) => setConfig({ ...config, customDetails: e.target.value })}
                                        placeholder="e.g., Guarding my group"
                                        style={{ 
                                            width: '100%', 
                                            padding: '0.6rem', 
                                            background: 'rgba(0,0,0,0.3)', 
                                            border: '1px solid var(--border-color)', 
                                            color: 'white',
                                            borderRadius: '6px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: 'var(--color-text-dim)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                        State (Line 2)
                                    </label>
                                    <input 
                                        type="text"
                                        value={config.customState}
                                        onChange={(e) => setConfig({ ...config, customState: e.target.value })}
                                        placeholder="e.g., Keeping VRChat safe"
                                        style={{ 
                                            width: '100%', 
                                            padding: '0.6rem', 
                                            background: 'rgba(0,0,0,0.3)', 
                                            border: '1px solid var(--border-color)', 
                                            color: 'white',
                                            borderRadius: '6px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: '0.5rem' }}>
                                Leave blank to use automatic status based on your activity
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
                        {message && (
                            <span style={{ 
                                color: message.includes('Error') || message.includes('failed') ? 'var(--color-error)' : 'var(--color-success)', 
                                fontSize: '0.9rem' 
                            }}>
                                {message}
                            </span>
                        )}
                        <NeonButton variant="ghost" onClick={handleReconnect} disabled={loading}>
                            Reconnect
                        </NeonButton>
                        <NeonButton variant="primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Save'}
                        </NeonButton>
                    </div>
                </div>
            </div>
        </section>
    );
};
