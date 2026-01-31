import React, { useEffect, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { NeonButton } from '../../../components/ui/NeonButton';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { Shield, ShieldAlert, CheckCircle, Zap, Clock, Minimize2, Pause, Play, XCircle } from 'lucide-react'; // Added icons
import { RuleCard } from '../../automod/components/RuleCard';
import { useRecruitStore } from '../../../stores/recruitStore';

// Removed empty interface
export const MassRecruitDialog: React.FC = () => {
    // Global Store State - Use selectors for stability
    const isOpen = useRecruitStore(s => s.isOpen);
    const isActive = useRecruitStore(s => s.isActive);
    const isPaused = useRecruitStore(s => s.isPaused);
    const minimized = useRecruitStore(s => s.minimized);
    const targetGroupId = useRecruitStore(s => s.targetGroupId);
    const targetGroupName = useRecruitStore(s => s.targetGroupName);
    const config = useRecruitStore(s => s.config);
    const progress = useRecruitStore(s => s.progress);
    const logs = useRecruitStore(s => s.logs);
    
    // Actions
    const startRecruit = useRecruitStore(s => s.startRecruit);
    const pauseRecruit = useRecruitStore(s => s.pauseRecruit);
    const resumeRecruit = useRecruitStore(s => s.resumeRecruit);
    const cancelRecruit = useRecruitStore(s => s.cancelRecruit);
    const close = useRecruitStore(s => s.close);
    const minimize = useRecruitStore(s => s.minimize);
    
    // Local config state (only synced to store when starting?)
    // Actually, let's just keep local config state for the "Config" phase, 
    // and only commit to store when running.
    // OR, better yet, use store for everything so it persists if you close/reopen before starting.
    // For simplicity, we'll keep local config for the setup phase, 
    // but once running, we rely on store state.
    
    const [filterAutoMod, setFilterAutoMod] = React.useState(true);
    const [inviteSpeed, setInviteSpeed] = React.useState<number>(2500);
    const [speedLabel, setSpeedLabel] = React.useState('NORMAL');
    
    // Auto-scroll logs
    const logEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (isOpen && isActive) {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen, isActive]);

    // Handle IPC Progress Listener (Global - but we mount it here for now, or in the store?)
    // Ideally the store should handle logic, but stores in React are usually just state.
    // We'll put the listener here, but it needs to be active even if this dialog is closed?
    // NO. If this dialog component unmounts, we lose the listener if we put it here.
    // But we are moving this component to GlobalModals, so it will ALWAYS be mounted, just hidden via isOpen.
    // So putting the listener here is safe IF GlobalModals renders it conditionally with `isOpen &&` vs `style={{display: none}}`.
    // Valid setups: 
    // 1. GlobalModals always renders <MassRecruitDialog />, and the dialog itself handles "if (!isOpen) return null".
    // 2. GlobalModals renders it conditionally.
    
    // For "Background" processing, we need the listener to be active even if the UI is hidden (minimized).
    // So we should handle the listener in a top-level effect, OR just ensure this component is always mounted but returns null if closed?
    // If we return null, effects usually cleanup. 
    // BEST APPROACH: Put the listener hook in App.tsx or a dedicated `useRecruitLogic` hook called in App.
    // For now, let's assume GlobalModals will keep it mounted or we move listener to a hook.
    
    // Let's implement the listener here and ensure GlobalModals handles visibility via `isOpen` prop or style, 
    // NOT by unmounting. 
    // actually, typically Modals unmount when closed.
    
    // Refined Plan: The listener should be in `useRecruitStore` via a specialized init hook, 
    // OR we just put it in App.tsx.
    // Let's create a hook `useRecruitListener` and call it in AppLayout.
    
    // For this file, strictly UI.

    const handleStart = () => {
        // Commit config to store (actions) logic is in startRecruit
        // We need to update store config first? Use a setter?
        // Or just pass params to startRecruit
        useRecruitStore.setState(prev => ({ 
            config: { ...prev.config, delayMs: inviteSpeed, filterAutoMod } 
        }));
        startRecruit(inviteSpeed, filterAutoMod);
    };

    const isRunning = isActive;
    const isDone = !isActive && progress.total > 0 && (progress.sent + progress.skipped + progress.failed === progress.total);
    const isConfig = !isRunning && !isDone;

    // Rendering
    if (!isOpen || minimized) return null; // If minimized, we hide window (ProgressWidget takes over)

    const renderConfig = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
             <GlassPanel style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <RuleCard
                        title="AutoMod Rules"
                        description="Scan users against Group AutoMod rules before inviting."
                        statusLabel={filterAutoMod ? 'ON' : 'OFF'}
                        isEnabled={filterAutoMod}
                        onToggle={() => setFilterAutoMod(!filterAutoMod)}
                        color="var(--color-primary)"
                        icon={<ShieldAlert size={20} />}
                    />
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />

                {/* Speed Selection */}
                <div>
                     <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Invite Speed</div>
                     <div style={{ display: 'flex', gap: '10px' }}>
                        {[
                            { label: 'FAST', ms: 1500, icon: Zap, color: 'var(--color-danger)' },
                            { label: 'NORMAL', ms: 2500, icon: Clock, color: 'var(--color-primary)' },
                            { label: 'SAFE', ms: 4000, icon: Shield, color: 'var(--color-success)' },
                        ].map((opt) => (
                             <NeonButton
                                key={opt.label}
                                variant={speedLabel === opt.label ? 'primary' : 'ghost'}
                                onClick={() => { setInviteSpeed(opt.ms); setSpeedLabel(opt.label); }}
                                style={{ flex: 1, flexDirection: 'column', padding: '10px', height: 'auto', gap: '5px', borderColor: speedLabel === opt.label ? opt.color : undefined }}
                             >
                                <opt.icon size={20} color={opt.color} />
                                <span style={{fontSize: '0.8rem'}}>{opt.label}</span>
                             </NeonButton>
                        ))}
                     </div>
                </div>

             </GlassPanel>

             <NeonButton 
                onClick={handleStart}
                style={{ width: '100%', height: '50px', fontSize: '1.1rem' }}
             >
                START RECRUIT ({config.userIds.length} User{config.userIds.length !== 1 ? 's' : ''})
             </NeonButton>
        </div>
    );

    const renderRunning = () => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.5rem' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                <div className="spinner" style={{ 
                    width: '100%', height: '100%', 
                    border: '4px solid var(--color-surface-hover)', 
                    borderTopColor: isPaused ? 'var(--color-warning)' : 'var(--color-primary)', 
                    borderRadius: '50%', 
                    animation: isPaused ? 'none' : 'spin 1s linear infinite' // Stop spin if paused
                }} />
                {isPaused ? (
                    <Pause size={24} color="var(--color-warning)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                ) : (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold' }}>
                        {progress.total > 0 ? Math.round(((progress.sent + progress.skipped + progress.failed) / progress.total) * 100) : 0}%
                    </div>
                )}
            </div>
            
            <div style={{ textAlign: 'center' }}>
                <h3>{isPaused ? 'PAUSED' : 'Recruiting...'}</h3>
                <div style={{ color: 'var(--color-text-dim)', marginBottom: '5px' }}>
                    {isPaused ? 'Process paused.' : 'Scanning and Inviting users...'}
                </div>
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--color-success)' }}>Invited: {progress.sent}</span>
                    <span style={{ color: 'var(--color-warning)' }}>Skipped: {progress.skipped}</span>
                    <span style={{ color: 'var(--color-danger)' }}>Failed: {progress.failed}</span>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '10px' }}>
                {isPaused ? (
                    <NeonButton onClick={resumeRecruit} variant="primary" style={{ padding: '5px 15px', gap: '5px' }}>
                        <Play size={16} /> Resume
                    </NeonButton>
                ) : (
                    <NeonButton onClick={pauseRecruit} variant="secondary" style={{ padding: '5px 15px', gap: '5px' }}>
                        <Pause size={16} /> Pause
                    </NeonButton>
                )}
                
                <NeonButton onClick={cancelRecruit} variant="danger" style={{ padding: '5px 15px', gap: '5px' }}>
                    <XCircle size={16} /> Cancel
                </NeonButton>
            </div>

            <div style={{ width: '100%', height: '120px', background: 'black', borderRadius: '8px', padding: '10px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', color: '#0f0' }}>
                 {logs.map((log, i) => <div key={i}>{log}</div>)}
                 <div ref={logEndRef} />
            </div>
        </div>
    );

    const renderDone = () => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.5rem' }}>
             <CheckCircle size={64} color="var(--color-success)" />
             <h2>Complete</h2>
             <div style={{ textAlign: 'center' }}>
                 <p>Successfully processed {progress.total} targets.</p>
                 <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '10px' }}>
                    <span style={{ color: 'var(--color-success)' }}>Invited: {progress.sent}</span>
                    <span style={{ color: 'var(--color-warning)' }}>Skipped: {progress.skipped}</span>
                    <span style={{ color: 'var(--color-danger)' }}>Failed: {progress.failed}</span>
                </div>
             </div>
             
             <NeonButton onClick={close} style={{ width: '200px' }}>CLOSE</NeonButton>
        </div>
    );

    return (
        <Modal 
            isOpen={isOpen && !minimized} 
            onClose={close} // Clicking X closes. 
            // We should add a "Minimize" button to the header if running?
            // Modal component might not support custom header actions easily, 
            // but we can add it to the content or wrapper.
            title={`SMART RECRUIT: ${targetGroupName || targetGroupId}`}
            width="600px"
        >
            <div style={{ height: '450px', position: 'relative' }}>
                {/* Minimize Button (Top Right Absolute) */}
                {isActive && (
                    <div style={{ position: 'absolute', top: '-50px', right: '40px', cursor: 'pointer', color: 'var(--color-text-dim)' }} onClick={minimize} title="Minimize to background">
                        <Minimize2 size={20} />
                    </div>
                )}

                {isConfig && renderConfig()}
                {(isRunning || (isActive === false && !isDone && !isConfig)) && renderRunning()} 
                {/* Fallback to running view if we have logs but not active, likely error or finished */}
                {isDone && renderDone()}
            </div>
        </Modal>
    );
};
