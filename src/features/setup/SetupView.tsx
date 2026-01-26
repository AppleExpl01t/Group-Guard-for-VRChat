import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { NeonButton } from '../../components/ui/NeonButton';
import { useNotificationStore } from '../../stores/notificationStore';

interface SetupViewProps {
    onComplete: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({ onComplete }) => {
    const [path, setPath] = useState('');
    const [defaultPath, setDefaultPath] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { addNotification } = useNotificationStore();

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const status = await window.electron.storage.getStatus();
                setDefaultPath(status.defaultPath);
                
                if (status.configured) {
                    onComplete();
                } else {
                    setPath(status.lastPath || status.defaultPath);
                }
            } catch (error) {
                console.error('Failed to check status:', error);
                addNotification({
                    type: 'error',
                    title: 'Initialization Error',
                    message: 'Failed to load storage settings.'
                });
            } finally {
                setIsLoading(false);
            }
        };
        
        checkStatus();
    }, [onComplete, addNotification]);

    const handleSelectFolder = async () => {
        const selected = await window.electron.storage.selectFolder();
        if (selected) {
            setPath(selected);
        }
    };

    const handleContinue = async () => {
        // If path hasn't changed from what was effectively the default/initial, 
        // we can just proceed. However, the backend needs to know it's configured.
        // We always call setPath to ensure the config file is written/marked.
        // But the user asked not to show a "dialogue". Since we don't show a dialogue
        // on success internally here (just onComplete), maybe the backend was showing something?
        // Or maybe the user meant "don't ask for confirmation"?
        
        // Actually, setPath returns boolean. 
        // If user changed nothing, we proceed silently.
        
        setIsLoading(true);
        const success = await window.electron.storage.setPath(path);
        
        if (success) {
            onComplete();
        } else {
            addNotification({
                type: 'error',
                title: 'Configuration Failed',
                message: 'Failed to save storage settings.'
            });
            setIsLoading(false);
        }
    };

    if (isLoading) return null;

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-start', // Align to top for scrolling
            minHeight: '100vh',
            padding: '2rem',
            background: 'radial-gradient(circle at center, #1a1a2e 0%, #000000 100%)',
            overflowY: 'auto'
        }}>
            <GlassPanel style={{ width: '100%', maxWidth: '900px', padding: '2rem', margin: 'auto 0' }}> 
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.25rem', fontWeight: 800 }}>
                            System Configuration
                        </h1>
                        <p style={{ color: 'var(--color-text-dim)', maxWidth: '600px', margin: '0 auto', fontSize: '0.9rem' }}>
                            Setup storage and enable advanced integration features.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 4fr)', gap: '2rem', alignItems: 'start' }}>
                        
                        {/* Left: Storage Configuration */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{ color: 'white', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                    <span style={{ background: 'var(--color-primary)', color: 'black', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>1</span>
                                    Data Storage
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', marginBottom: '0.8rem', lineHeight: '1.4' }}>
                                    Select where Group Guard logs, databases, and cache should be stored. The default location is usually best.
                                </p>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input 
                                            type="text" 
                                            value={path} 
                                            readOnly 
                                            style={{ 
                                                flex: 1, 
                                                background: 'rgba(0,0,0,0.3)', 
                                                border: '1px solid rgba(255,255,255,0.1)', 
                                                borderRadius: '4px',
                                                padding: '0.6rem',
                                                color: 'white',
                                                fontFamily: 'monospace',
                                                fontSize: '0.8rem'
                                            }}
                                        />
                                        <NeonButton size="sm" variant="ghost" onClick={handleSelectFolder}>
                                            Browse
                                        </NeonButton>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem' }}>
                                        Default: {defaultPath}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem', background: 'rgba(var(--primary-hue), 100%, 50%, 0.1)', border: '1px solid rgba(var(--primary-hue), 100%, 50%, 0.2)', padding: '1rem', borderRadius: '8px' }}>
                                <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--color-primary)', fontSize: '0.9rem' }}>Why these steps matter?</h4>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.4' }}>
                                    Configuring these options enables <b>Real-Time Live Data</b>. Without them, the app cannot detect instance changes, update player lists, or track moderation events instantly.
                                </p>
                            </div>
                        </div>

                        {/* Right: Game Instructions */}
                        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '2rem' }}>
                            <h3 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                <span style={{ background: 'var(--color-accent)', color: 'black', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>2</span>
                                Enable Live Features
                            </h3>

                            {/* Step A: Steam */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ color: 'var(--color-accent)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>A. Steam Launch Options (Required)</h4>
                                <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                                    <li>Open Steam and go to your <b>Library</b>.</li>
                                    <li>Right-click <b>VRChat</b>, then select <b>Properties</b>.</li>
                                    <li>In the <b>General</b> tab, find <b>Launch Options</b>.</li>
                                    <li>Paste the code below into the text box under "Advanced users..."</li>
                                </ol>
                                <div style={{ 
                                    background: 'black', 
                                    padding: '0.6rem', 
                                    borderRadius: '6px', 
                                    marginTop: '0.6rem', 
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <code style={{ color: '#4cc9f0', fontFamily: 'monospace', fontSize: '0.85rem', userSelect: 'all' }}>--enable-sdk-log-levels</code>
                                </div>
                            </div>

                            {/* Step B: VRChat */}
                            <div>
                                <h4 style={{ color: 'var(--color-accent)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>B. In-Game Debug Settings (Required)</h4>
                                <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                                    <li>Launch VRChat and open your <b>Main Menu</b>.</li>
                                    <li>Open the large <b>Settings</b> menu.</li>
                                    <li>Scroll/Navigate to the <b>Debug</b> section.</li>
                                    <li>Find the <b>Logging</b> option.</li>
                                    <li>Change the setting to <b>Full</b>.</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                        <NeonButton onClick={handleContinue} size="lg" style={{ minWidth: '240px' }}>
                            Complete Setup & Launch
                        </NeonButton>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                            By clicking above, you confirm you have reviewed the settings.
                        </span>
                    </div>
                </motion.div>
            </GlassPanel>
        </div>
    );
};
