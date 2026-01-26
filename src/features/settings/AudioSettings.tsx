import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, RotateCcw, Music } from 'lucide-react';
import { NeonButton } from '../../components/ui/NeonButton';
import type { AppSettings } from '../../types/electron';
import notificationSoundHelper from '../../assets/sounds/notification.mp3';

// Inner card style for settings sections (used inside main GlassPanel)
const innerCardStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '12px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.05)',
};

export const AudioSettings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings['audio']>({ notificationSoundPath: null, volume: 0.6 });
    const [previewData, setPreviewData] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const loadSettings = React.useCallback(async () => {
        try {
            const current = await window.electron.settings.get();
            setSettings(current.audio);
            // If custom sound is set, preload it for preview
            if (current.audio.notificationSoundPath) {
                 const data = await window.electron.settings.getAudioData(current.audio.notificationSoundPath);
                 setPreviewData(data);
            } else {
                setPreviewData(null); // Use default
            }
        } catch (error) {
            console.error('Failed to load settings', error);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleSelectFile = async () => {
        try {
            const result = await window.electron.settings.selectAudio();
            if (result) {
                setSettings(prev => ({ ...prev, notificationSoundPath: result.path }));
                setPreviewData(result.data);
                await window.electron.settings.update({ 
                    audio: { ...settings, notificationSoundPath: result.path } 
                });
            }
        } catch (error) {
            console.error('Failed to select file', error);
        }
    };

    const handleReset = async () => {
        setSettings(prev => ({ ...prev, notificationSoundPath: null }));
        setPreviewData(null);
        await window.electron.settings.update({ 
            audio: { ...settings, notificationSoundPath: null } 
        });
    };

    const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setSettings(prev => ({ ...prev, volume: newVolume }));
        
        await window.electron.settings.update({ 
            audio: { ...settings, volume: newVolume } 
        });
        
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    const playPreview = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        const src = previewData || notificationSoundHelper;
        const audio = new Audio(src);
        audio.volume = settings.volume;
        audioRef.current = audio;
        audio.play().catch(e => console.error("Preview failed", e));
    };

    return (
        <section>
            <h2 style={{ color: 'white', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Audio</h2>
            <div style={innerCardStyle}>
                <div className="space-y-6">
                    {/* Current Sound */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2" style={{ color: 'var(--color-text-dim)', marginBottom: '0.5rem' }}>
                            <Music size={14} className="text-purple-400" style={{ color: 'var(--color-accent)' }} />
                            Notification Sound
                        </label>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1rem' }}>
                            <div style={{ flex: 1, fontSize: '0.9rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {settings.notificationSoundPath ? 
                                    settings.notificationSoundPath.split(/[\\/]/).pop() : 
                                    'Default (System)'}
                            </div>
                            <button 
                                onClick={playPreview}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px', height: '32px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'var(--color-accent)'
                                }}
                                title="Preview Sound"
                            >
                                <Play size={16} fill="currentColor" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <NeonButton 
                                variant="secondary" 
                                size="sm" 
                                style={{ flex: 1 }}
                                onClick={handleSelectFile}
                            >
                                <Upload size={14} style={{ marginRight: '8px' }} />
                                Upload Custom
                            </NeonButton>
                            {settings.notificationSoundPath && (
                                <NeonButton 
                                    variant="danger" 
                                    size="sm"
                                    onClick={handleReset}
                                >
                                    <RotateCcw size={14} />
                                </NeonButton>
                            )}
                        </div>
                    </div>

                    {/* Volume */}
                    <div className="space-y-3" style={{ marginTop: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-dim)' }}>Alert Volume</label>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                                {Math.round(settings.volume * 100)}%
                            </span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.05"
                            value={settings.volume}
                            onChange={handleVolumeChange}
                            style={{
                                width: '100%',
                                accentColor: 'var(--color-accent)',
                                height: '4px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};
