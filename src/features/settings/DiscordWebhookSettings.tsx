import React, { useState, useEffect, useCallback } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { NeonButton } from '../../components/ui/NeonButton';
import { ChevronDown, ChevronUp, Webhook } from 'lucide-react';

// Inner card style for settings sections (used inside main GlassPanel)
const innerCardStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '12px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.05)',
};

export const DiscordWebhookSettings: React.FC = () => {
    const { selectedGroup } = useGroupStore();
    const [webhookUrl, setWebhookUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [showGuide, setShowGuide] = useState(false);

    const loadWebhook = useCallback(async () => {
        if (!selectedGroup) return;
        try {
            const url = await window.electron.webhook.getUrl(selectedGroup.id);
            setWebhookUrl(url || '');
        } catch (e) {
            console.error(e);
        }
    }, [selectedGroup]);

    useEffect(() => {
        if (selectedGroup) {
            // Use setTimeout to avoid synchronous setState in effect
            const timeoutId = setTimeout(() => {
                loadWebhook();
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [selectedGroup, loadWebhook]);

    const handleSave = async () => {
        if (!selectedGroup) return;
        setIsLoading(true);
        setStatus('');
        try {
            await window.electron.webhook.setUrl(selectedGroup.id, webhookUrl);
            setStatus('Saved!');
            setTimeout(() => setStatus(''), 2000);
        } catch (e) {
            console.error(e);
            setStatus('Error saving');
        }
        setIsLoading(false);
    };

    const handleTest = async () => {
        if (!selectedGroup) return;
        setStatus('Testing...');
        try {
            await window.electron.webhook.test(selectedGroup.id);
            setStatus('Test Signal Sent!');
            setTimeout(() => setStatus(''), 2000);
        } catch (e) {
            console.error(e);
            setStatus('Test Failed');
        }
    };

    const handleSimulate = async () => {
        if (!selectedGroup) return;
        setStatus('Simulating...');
        try {
            await window.electron.webhook.testMock(selectedGroup.id);
            setStatus('Sim Sent!');
            setTimeout(() => setStatus(''), 2000);
        } catch (e) {
            console.error(e);
            setStatus('Sim Failed');
        }
    };

    // if (!selectedGroup) return null; // Removed early return

    return (
        <section>
             <h2 style={{ color: 'white', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display:'flex', alignItems:'center', gap: '10px' }}>
                <Webhook size={20} />
                Events Webhook
            </h2>
            <div style={innerCardStyle}>
                {!selectedGroup ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-dim)', fontStyle: 'italic' }}>
                        Please select a group from the dashboard to configure its webhook settings.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <div style={{ color: 'white', fontWeight: 600, marginBottom: '0.25rem' }}>Webhook URL</div>
                        <div style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Receive automated logs (Kicks, Bans, AutoMod Actions) in your Discord server.
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                                type="password" 
                                placeholder="https://discord.com/api/webhooks/..."
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                style={{ 
                                    flex: 1,
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <button 
                            onClick={() => setShowGuide(!showGuide)}
                            style={{ 
                                background: 'transparent', border: 'none', color: 'var(--color-primary)', 
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem'
                            }}
                        >
                            {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {showGuide ? 'Hide Setup Guide' : 'How to set up?'}
                        </button>
                        
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {status && <span style={{ color: status.includes('Failed') || status.includes('Error') ? 'var(--color-error)' : 'var(--color-success)' }}>{status}</span>}
                            <NeonButton variant="ghost" size="sm" onClick={handleTest} disabled={!webhookUrl}>Test</NeonButton>
                            <NeonButton variant="ghost" size="sm" onClick={handleSimulate} disabled={!webhookUrl}>Simulate Ban</NeonButton>
                            <NeonButton variant="primary" size="sm" onClick={handleSave} disabled={isLoading}>Save</NeonButton>
                        </div>
                    </div>

                    {showGuide && (
                        <div style={{ 
                            background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', 
                            borderLeft: '3px solid var(--color-primary)', fontSize: '0.9rem', color: 'var(--color-text-dim)'
                        }}>
                            <ol style={{ paddingLeft: '1.5rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <li>Open your Discord Server settings or Channel settings.</li>
                                <li>Go to <strong>Integrations</strong> → <strong>Webhooks</strong>.</li>
                                <li>Click <strong>New Webhook</strong>.</li>
                                <li>Choose the channel where you want logs to appear.</li>
                                <li>Copy the <strong>Webhook URL</strong> and paste it above.</li>
                            </ol>
                        </div>
                    )}
                </div>

                )}
            </div>
        </section>
    );
};
