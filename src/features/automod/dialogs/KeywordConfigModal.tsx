import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { ChipInput } from '../components/ChipInput';

interface KeywordConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSave: (newConfig: any) => void;
}

export const KeywordConfigModal: React.FC<KeywordConfigModalProps> = ({ isOpen, onClose, config, onSave }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [internalConfig, setInternalConfig] = React.useState<any>(config);

    React.useEffect(() => {
        if (isOpen) {
            setInternalConfig(config);
        }
    }, [isOpen, config]);

    const handleSave = () => {
        onSave(internalConfig);
        onClose();
    };

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
                    {/* Modal Content */}
                    <motion.div
                        key="modal-content"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            style={{ 
                                width: '90%', 
                                maxWidth: '1000px', 
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
                                border: '1px solid rgba(239, 68, 68, 0.3)', 
                                boxShadow: '0 0 30px rgba(239, 68, 68, 0.1)', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                height: '100%', 
                                maxHeight: '100%',
                                minHeight: 0
                            }}>
                                {/* Header */}
                                <div style={{ padding: '1.5rem 1.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: '#f87171' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                        </div>
                                        Keyword Filter Configuration
                                    </h2>
                                    <button 
                                        onClick={onClose}
                                        style={{ background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: '1.5rem', display: 'flex' }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>

                                {/* 2-Column Grid Layout */}
                                <div style={{ 
                                    padding: '1.5rem', 
                                    overflowY: 'auto', 
                                    flex: '1 1 auto', 
                                    minHeight: 0, 
                                    display: 'grid', 
                                    gridTemplateColumns: '1.4fr 1fr', 
                                    gap: '2rem',
                                    alignItems: 'start'
                                }}>
                                    
                                    {/* Left Column: Input Lists */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        <div>
                                            <ChipInput 
                                                label="Blocked Keywords"
                                                placeholder="Add word to ban..."
                                                value={internalConfig.keywords || []}
                                                color="red"
                                                onChange={(newVal) => setInternalConfig({ ...internalConfig, keywords: newVal })}
                                            />
                                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '-8px', paddingLeft: '4px' }}>
                                                <span style={{ color: '#fca5a5' }}>Pro Tip:</span> To block an acronym (like "D.I.D") without banning the word "did", enter it with periods: <strong>d.i.d</strong>
                                            </div>
                                        </div>

                                        <ChipInput 
                                            label="Safelist (Keyword Exceptions)"
                                            placeholder="Add allowed word..."
                                            value={internalConfig.whitelist || []}
                                            color="green"
                                            onChange={(newVal) => setInternalConfig({ ...internalConfig, whitelist: newVal })}
                                        />

                                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-dim)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exemptions</div>
                                            
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <ChipInput 
                                                    label="Whitelisted Users (IDs)"
                                                    placeholder="usr_..."
                                                    value={internalConfig.whitelistedUserIds || []}
                                                    color="blue"
                                                    onChange={(newVal) => setInternalConfig({ ...internalConfig, whitelistedUserIds: newVal })}
                                                />
                                            </div>

                                            <ChipInput 
                                                label="Whitelisted Groups (IDs)"
                                                placeholder="grp_..."
                                                value={internalConfig.whitelistedGroupIds || []}
                                                color="purple"
                                                onChange={(newVal) => setInternalConfig({ ...internalConfig, whitelistedGroupIds: newVal })}
                                            />
                                        </div>
                                    </div>

                                    {/* Right Column: Configuration & Strategy */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        
                                        {/* Scanning Fields */}
                                        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scanning Fields</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {[
                                                    { k: 'scanBio', l: 'Bio' }, 
                                                    { k: 'scanStatus', l: 'Status' },
                                                    { k: 'scanPronouns', l: 'Pronouns' },
                                                    { k: 'scanGroups', l: 'Groups' }
                                                ].map(opt => (
                                                    <div 
                                                        key={opt.k}
                                                        onClick={() => setInternalConfig({ ...internalConfig, [opt.k]: !internalConfig[opt.k] })}
                                                        style={{ 
                                                            padding: '6px 12px', 
                                                            borderRadius: '6px', 
                                                            background: internalConfig[opt.k] ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255,255,255,0.05)',
                                                            border: internalConfig[opt.k] ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.1)',
                                                            color: internalConfig[opt.k] ? 'white' : 'var(--color-text-dim)',
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', gap: '8px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: internalConfig[opt.k] ? '#4ade80' : 'rgba(255,255,255,0.2)' }} />
                                                        {opt.l}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Strategy */}
                                        <div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-dim)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matching Strategy</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginBottom: '1rem', fontStyle: 'italic', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px', display: 'flex' }}>
                                                Example: Blocked <strong style={{ color: '#f87171', margin: '0 4px' }}>"bad"</strong> & <strong style={{ color: '#f87171', marginLeft: '4px' }}>"lol"</strong>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {/* Strict Card */}
                                                <div 
                                                    onClick={() => setInternalConfig({ ...internalConfig, matchMode: 'WHOLE_WORD' })}
                                                    style={{ 
                                                        padding: '1rem', 
                                                        borderRadius: '8px', 
                                                        background: internalConfig.matchMode !== 'PARTIAL' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255,255,255,0.02)',
                                                        border: internalConfig.matchMode !== 'PARTIAL' ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        opacity: internalConfig.matchMode !== 'PARTIAL' ? 1 : 0.6,
                                                        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', alignItems: 'center'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: internalConfig.matchMode !== 'PARTIAL' ? '#4ade80' : 'white', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid currentColor', background: internalConfig.matchMode !== 'PARTIAL' ? 'currentColor' : 'transparent' }}></div>
                                                            Strict (Whole Word)
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                                                            Smartly handles acronyms.
                                                        </div>
                                                    </div>
                                                    
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontSize: '0.7rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                            <span style={{ color: '#d4d4d4' }}>"badger"</span>
                                                            <span style={{ fontWeight: 'bold', color: '#4ade80' }}>✓ Safe</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#d4d4d4' }}>"l.o.l"</span>
                                                            <span style={{ fontWeight: 'bold', color: '#f87171' }}>✖ Block</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Loose Card */}
                                                <div 
                                                    onClick={() => setInternalConfig({ ...internalConfig, matchMode: 'PARTIAL' })}
                                                    style={{ 
                                                        padding: '1rem', 
                                                        borderRadius: '8px', 
                                                        background: internalConfig.matchMode === 'PARTIAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.02)',
                                                        border: internalConfig.matchMode === 'PARTIAL' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        opacity: internalConfig.matchMode === 'PARTIAL' ? 1 : 0.6,
                                                        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', alignItems: 'center'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: internalConfig.matchMode === 'PARTIAL' ? '#f87171' : 'white', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid currentColor', background: internalConfig.matchMode === 'PARTIAL' ? 'currentColor' : 'transparent' }}></div>
                                                            Loose (Partial)
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                                                            Matches everywhere.
                                                        </div>
                                                    </div>

                                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontSize: '0.7rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                            <span style={{ color: '#d4d4d4' }}>"badger"</span>
                                                            <span style={{ fontWeight: 'bold', color: '#f87171' }}>✖ Block</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#d4d4d4' }}>"l.o.l"</span>
                                                            <span style={{ fontWeight: 'bold', color: '#f87171' }}>✖ Block</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sticky Footer */}
                                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                                    <button 
                                        onClick={handleSave}
                                        style={{ 
                                            padding: '10px 24px', 
                                            background: '#f87171', 
                                            color: 'black', 
                                            border: 'none', 
                                            borderRadius: '6px', 
                                            fontWeight: 'bold', 
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(248, 113, 113, 0.3)',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            </GlassPanel>
                        </motion.div>
                    </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
