import React, { useState } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { AnimatePresence, motion } from 'framer-motion';

// --- Types ---
type AutoModModule = 'GATEKEEPER' | 'SENTINEL' | 'IMMUNITY';

// --- Local Components ---

const ModuleTab: React.FC<{ 
    active: boolean; 
    label: string; 
    icon: React.ReactNode; 
    onClick: () => void 
}> = ({ active, label, icon, onClick }) => (
    <button
        onClick={onClick}
        style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            padding: '12px 24px',
            color: active ? 'white' : 'var(--color-text-dim)',
            fontWeight: 800,
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color 0.3s ease',
            outline: 'none',
            zIndex: 1
        }}
    >
        <span style={{ fontSize: '1.2rem', opacity: active ? 1 : 0.7 }}>{icon}</span>
        {label}
        
        {/* Active Indicator & Glow - "Sci-Fi Underline" */}
        {active && (
            <motion.div
                layoutId="activeTab"
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--color-primary)',
                    boxShadow: '0 -2px 10px var(--color-primary)',
                    borderRadius: '2px'
                }}
            />
        )}
        
        {/* Subtle Background Highlight on Active */}
        {active && (
            <motion.div
                layoutId="activeTabBg"
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(var(--primary-hue), 100%, 50%, 0.1) 0%, transparent 100%)',
                    borderRadius: '8px 8px 0 0',
                    zIndex: -1
                }}
            />
        )}
    </button>
);

// --- Sub-Views (Placeholders) ---

const GatekeeperView = () => (
    <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        exit={{ opacity: 0, y: -10 }}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', height: '100%' }}>
            {/* Rules Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <GlassPanel style={{ padding: '1.5rem', borderLeft: '4px solid var(--color-primary)' }}>
                    <h3 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%', boxShadow: '0 0 10px #4ade80' }}></span>
                        Request Firewall
                    </h3>
                    <p style={{ margin: 0, color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>
                        Active sorting protocols for incoming group join requests. 
                        Requests are pre-scanned before you even see them.
                    </p>
                </GlassPanel>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {[1, 2, 3].map(i => (
                        <GlassPanel key={i} style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <span style={{ color: 'var(--color-text-dim)', fontStyle: 'italic' }}>Rule Slot {i}</span>
                        </GlassPanel>
                    ))}
                </div>
            </div>

            {/* Stats / Feed Sidepanel */}
            <GlassPanel style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                    INTERCEPTION LOG
                </div>
                <div style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    [NO RECENT ACTIVITY]
                </div>
            </GlassPanel>
        </div>
    </motion.div>
);

const SentinelView = () => (
    <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        exit={{ opacity: 0, y: -10 }}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
        {/* Header Status */}
        <GlassPanel style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, transparent 50%)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div>
                <h3 style={{ margin: 0, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                    SENTINEL MODULE OFFLINE
                </h3>
                <p style={{ margin: '0.2rem 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                    Live instance monitoring is currently disabled. Enable to scan concurrent users.
                </p>
            </div>
            <button style={{ 
                padding: '8px 20px', 
                background: 'rgba(239, 68, 68, 0.2)', 
                border: '1px solid rgba(239, 68, 68, 0.5)', 
                color: '#fca5a5', 
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textTransform: 'uppercase',
                fontSize: '0.8rem',
                letterSpacing: '0.05em'
            }}>
                Initialize
            </button>
        </GlassPanel>

        {/* Live Terminal */}
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem', color: '#4ade80', overflow: 'hidden', position: 'relative' }}>
            <div style={{ opacity: 0.5, marginBottom: '0.5rem' }}>// LIVE_FEED_CONNECTION... PENDING</div>
            <div style={{ height: '2px', width: '20px', background: '#4ade80', animation: 'blink 1s infinite' }}></div>
            
            <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', fontSize: '4rem', opacity: 0.05, fontWeight: 900, color: 'white', pointerEvents: 'none' }}>
                MONITOR
            </div>
        </div>
    </motion.div>
);

const ImmunityView = () => (
    <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        exit={{ opacity: 0, y: -10 }}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
        <GlassPanel style={{ width: '100%', maxWidth: '600px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', margin: '0 auto 1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <h2 style={{ margin: '0 0 0.5rem' }}>Global Immunity</h2>
            <p style={{ color: 'var(--color-text-dim)', marginBottom: '2rem' }}>
                Define entities that bypass all security layers (Gatekeeper & Sentinel).
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left' }}>
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontWeight: 'bold' }}>VIP Users</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginTop: '4px' }}>Specific usernames</div>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontWeight: 'bold' }}>Trust Ranks</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginTop: '4px' }}>System-wide ranks</div>
                </div>
            </div>
        </GlassPanel>
    </motion.div>
);

// --- Main Container ---

export const AutoModView: React.FC = () => {
    const [activeModule, setActiveModule] = useState<AutoModModule>('GATEKEEPER');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', paddingBottom: '20px' }}>
            
            {/* Top Navigation Bar */}
            <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}>
                <GlassPanel style={{ padding: '4px', borderRadius: '12px', display: 'flex', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
                    <ModuleTab 
                        active={activeModule === 'GATEKEEPER'} 
                        label="GATEKEEPER" 
                        icon={<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>}
                        onClick={() => setActiveModule('GATEKEEPER')} 
                    />
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }}></div>
                    <ModuleTab 
                        active={activeModule === 'SENTINEL'} 
                        label="SENTINEL" 
                        icon={<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
                        onClick={() => setActiveModule('SENTINEL')} 
                    />
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }}></div>
                    <ModuleTab 
                        active={activeModule === 'IMMUNITY'} 
                        label="IMMUNITY" 
                        icon={<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>}
                        onClick={() => setActiveModule('IMMUNITY')} 
                    />
                </GlassPanel>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <AnimatePresence mode='wait'>
                    {activeModule === 'GATEKEEPER' && (
                        <motion.div key="gatekeeper" style={{ height: '100%' }}>
                            <GatekeeperView />
                        </motion.div>
                    )}
                    {activeModule === 'SENTINEL' && (
                        <motion.div key="sentinel" style={{ height: '100%' }}>
                            <SentinelView />
                        </motion.div>
                    )}
                    {activeModule === 'IMMUNITY' && (
                        <motion.div key="immunity" style={{ height: '100%' }}>
                            <ImmunityView />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
