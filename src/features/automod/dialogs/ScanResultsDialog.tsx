import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { NeonButton } from '../../../components/ui/NeonButton';
import { Button } from '../../../components/ui/Button';
import { useGroupStore } from '../../../stores/groupStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useScanStore } from '../../../stores/scanStore';
import type { ScanResult } from '../../../types/electron';
import { UserActionModal } from './UserActionModal';

interface ScanResultsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.05,
            duration: 0.3
        }
    })
};

export const ScanResultsDialog: React.FC<ScanResultsDialogProps> = ({ isOpen, onClose }) => {
    const { selectedGroup } = useGroupStore();
    const { results, isLoading, progress, updateResult } = useScanStore();
    const { addNotification } = useNotificationStore();
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    
    // State for detailing user
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedUserForAction, setSelectedUserForAction] = useState<ScanResult | null>(null);

    const handleAction = async (userId: string, action: 'kick' | 'ban' | 'unban') => {
        if (!selectedGroup) return;
        setActionLoading(userId);
        
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const electron = (window as any).electron;
            let res: { success: boolean; error?: string } = { success: false };

            if (action === 'kick') {
                res = await electron.instance.kickUser(selectedGroup.id, userId);
            } else if (action === 'ban') {
                res = await electron.banUser(selectedGroup.id, userId);
            } else if (action === 'unban') {
                res = await electron.instance.unbanUser(selectedGroup.id, userId);
            }

            if (res?.success) {
                addNotification({ type: 'success', title: 'Action Success', message: `User ${action}ed successfully` });
                
                // Update global store
                updateResult(userId, { 
                    action: action === 'ban' ? 'BANNED' : action === 'unban' ? 'VIOLATION' : 'VIOLATION'
                    // Note: 'KICKED' isn't in ScanResult action types usually, but assuming 'VIOLATION' or strict type.
                    // If type is strict, let's stick to valid types.
                    // ScanResult action: 'SAFE' | 'VIOLATION' | 'BANNED' | 'KICKED' (if added)
                    // If 'KICKED' is not valid, we might just keep it as VIOLATION but maybe add a flag?
                    // For now assuming we can set it to 'VIOLATION' (unchanged) for kick, or if we want to visually show it.
                    // Let's assume KICK doesn't change persistent status besides maybe removing them from instance, 
                    // but functionally in the list they are still a violation.
                });
            } else {
                throw new Error(res?.error || 'Unknown error');
            }
        } catch (e) {
            console.error(e);
            addNotification({ type: 'error', title: 'Action Failed', message: String(e) });
        } finally {
            setActionLoading(null);
        }
    };
    
    const handleUserClick = (result: ScanResult) => {
        setSelectedUserForAction(result);
        setIsActionModalOpen(true);
    };

    if (!isOpen) return null;

    const violations = results.filter(r => r.action !== 'SAFE');
    const safeCount = results.length - violations.length;

    return createPortal(
        <>
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
                            background: 'rgba(0,0,0,0.85)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 10000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }}
                    >
                        <motion.div
                            key="modal-content"
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{ 
                                width: '100%', 
                                maxWidth: '750px', 
                                maxHeight: '85vh',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                             <GlassPanel style={{ 
                                padding: 0, 
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '85vh',
                                overflow: 'hidden',
                                border: '1px solid var(--color-border)',
                                boxShadow: '0 0 50px rgba(0,0,0,0.6)',
                                background: 'var(--color-bg-panel)' 
                            }}>
                                 <div style={{ 
                                    padding: '1.5rem', 
                                    borderBottom: '1px solid var(--color-border)',
                                    background: 'linear-gradient(to bottom, rgba(255,255,255,0.02), transparent)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    flexShrink: 0,
                                    gap: '1rem'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Scan Results</h2>
                                            {progress && progress.phase !== 'complete' && progress.phase !== 'idle' && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', fontFamily: 'monospace' }}>
                                                    {progress.current} / {progress.total}
                                                </div>
                                            )}
                                        </div>

                                        {/* LIVE STATUS AREA */}
                                        {progress && progress.phase !== 'idle' && progress.phase !== 'complete' && (
                                            <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                                                        {progress.phase === 'fetching' ? 'Fetching group members...' : 'Scanning Member:'}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: progress.currentStatus === 'violation' ? 'var(--color-danger)' : progress.currentStatus === 'safe' ? 'var(--color-success)' : 'var(--color-text)', transition: 'color 0.2s' }}>
                                                        {progress.phase === 'fetching' ? `${progress.total} found so far` : progress.currentStatus === 'violation' ? 'VIOLATION DETECTED' : progress.currentStatus === 'safe' ? 'SAFE' : 'ANALYZING'}
                                                    </div>
                                                </div>
                                                
                                                {/* Current User Name with Flash */}
                                                <div style={{ 
                                                    fontSize: '1.1rem', 
                                                    fontWeight: 600, 
                                                    color: progress.currentStatus === 'violation' ? 'var(--color-danger)' : progress.currentStatus === 'safe' ? 'var(--color-success)' : 'var(--color-text)',
                                                    transition: 'color 0.1s',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {progress.currentName || '...'}
                                                </div>

                                                {/* Progress Bar */}
                                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '0.75rem', overflow: 'hidden' }}>
                                                    <motion.div 
                                                        style={{ height: '100%', background: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-primary)' }}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                                                        transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Completed Stats */}
                                        {(progress?.phase === 'complete' || (!isLoading && results.length > 0)) && (
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--color-text-dim)' }}>
                                                    Total Scanned: <strong style={{ color: 'var(--color-text)' }}>{progress?.total || results.length}</strong>
                                                </span>
                                                {violations.length > 0 && (
                                                    <span style={{ color: 'var(--color-danger)' }}>
                                                        Violations: <strong>{violations.length}</strong>
                                                    </span>
                                                )}
                                                {safeCount > 0 && (
                                                    <span style={{ color: 'var(--color-success)' }}>
                                                        Safe: <strong>{safeCount}</strong>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <Button 
                                        variant="ghost" 
                                        onClick={onClose} 
                                        className="hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </Button>
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {isLoading && results.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-dim)', minHeight: '300px' }}>
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" style={{ borderColor: 'var(--color-primary)' }}></div>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-text)' }}>Scanning group members...</p>
                                            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', maxWidth: '300px', textAlign: 'center' }}>
                                                Comparing members against enabled AutoMod rules. Please wait.
                                            </p>
                                        </div>
                                    ) : results.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-dim)', border: '2px dashed var(--color-border)', borderRadius: '1rem', margin: 'auto' }}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.5 }}>
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>No Violations Found</p>
                                            <p style={{ fontSize: '0.9rem' }}>All scanned members passed the current rules.</p>
                                        </div>
                                    ) : (
                                        violations.map((result, i) => (
                                            <motion.div
                                                key={result.userId}
                                                custom={i}
                                                variants={itemVariants}
                                                initial="hidden"
                                                animate="visible"
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    padding: '1rem', 
                                                    background: 'rgba(0,0,0,0.2)', 
                                                    borderRadius: '12px',
                                                    border: '1px solid var(--color-border)',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                                whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)', scale: 1.005, borderColor: 'rgba(255,255,255,0.2)' }}
                                            >
                                                {/* Status Indicator Stripe */}
                                                <div style={{
                                                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                                                    background: result.action === 'BANNED' ? 'var(--color-danger)' : '#fbbf24'
                                                }} />

                                                {/* Avatar */}
                                                <div style={{ 
                                                    width: '48px', 
                                                    height: '48px', 
                                                    borderRadius: '10px', 
                                                    background: 'rgba(0,0,0,0.3)',
                                                    marginRight: '1rem',
                                                    marginLeft: '8px',
                                                    backgroundImage: result.userIcon ? `url(${result.userIcon})` : 'none',
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                    border: `1px solid ${result.action === 'BANNED' ? 'var(--color-danger)' : '#fbbf24'}`,
                                                    boxShadow: `0 0 15px ${result.action === 'BANNED' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(251, 191, 36, 0.2)'}`,
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }} 
                                                onClick={() => handleUserClick(result)}
                                                />
                                                
                                                {/* Info */}
                                                <div style={{ flex: 1, minWidth: 0, marginRight: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                        <div 
                                                            style={{ 
                                                                fontWeight: 700, 
                                                                fontSize: '1rem', 
                                                                color: 'var(--color-text)', 
                                                                cursor: 'pointer',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}
                                                            onClick={() => handleUserClick(result)}
                                                            title="View User Details"
                                                            className="hover:underline"
                                                        >
                                                            {result.displayName}
                                                        </div>
                                                        {result.action === 'BANNED' && (
                                                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--color-danger)', color: 'black', fontWeight: 800, flexShrink: 0 }}>BANNED</span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Reason Row */}
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                        <span style={{ color: result.action === 'BANNED' ? 'var(--color-danger)' : '#fbbf24', fontWeight: 600, flexShrink: 0 }}>
                                                            {result.ruleName || 'Violation detected'}
                                                        </span>
                                                        {result.reason && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, maxWidth: '100%' }}>
                                                                <span style={{width: 3, height: 3, background: 'currentColor', borderRadius: '50%', opacity: 0.5, flexShrink: 0}}></span>
                                                                <span style={{ opacity: 0.9, color: 'var(--color-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={result.reason}>
                                                                    {result.reason}
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                    {result.ruleId && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                disabled={!!actionLoading}
                                                                onClick={async () => {
                                                                     if (!result.ruleId || !selectedGroup) return;
                                                                     setActionLoading(result.userId);
                                                                     try {
                                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                                        await (window as any).electron.automod.addToWhitelist(selectedGroup.id, result.ruleId, { userId: result.userId });
                                                                        addNotification({ type: 'success', title: 'User Whitelisted', message: `Added ${result.displayName} to whitelist.` });
                                                                        // Update local status to SAFE? Or just let scan re-run? 
                                                                        // Better to just update UI to show "Whitelisted"
                                                                        updateResult(result.userId, { action: 'SAFE' });
                                                                     } catch(e) {
                                                                         addNotification({ type: 'error', title: 'Error', message: String(e) });
                                                                     } finally {
                                                                         setActionLoading(null);
                                                                     }
                                                                }}
                                                                className="h-8 text-xs hover:bg-white/10"
                                                                style={{ color: '#fbbf24', borderColor: '#fbbf24' }} 
                                                            >
                                                                Whitelist User
                                                            </Button>
                                                            {selectedGroup && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    disabled={!!actionLoading}
                                                                    onClick={async () => {
                                                                         if (!result.ruleId || !selectedGroup) return;
                                                                         setActionLoading(result.userId);
                                                                         try {
                                                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                                            await (window as any).electron.automod.addToWhitelist(selectedGroup.id, result.ruleId, { groupId: selectedGroup.id });
                                                                            addNotification({ type: 'success', title: 'Group Whitelisted', message: `Added group to whitelist.` });
                                                                            // Trigger re-scan or update all?
                                                                         } catch(e) {
                                                                             addNotification({ type: 'error', title: 'Error', message: String(e) });
                                                                         } finally {
                                                                             setActionLoading(null);
                                                                         }
                                                                    }}
                                                                    className="h-8 text-xs hover:bg-white/10"
                                                                    style={{ color: '#fbbf24', borderColor: '#fbbf24' }}
                                                                >
                                                                    Whitelist Group
                                                                </Button>
                                                            )}
                                                            <div style={{width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px'}}></div>
                                                        </>
                                                    )}

                                                    {result.action === 'BANNED' ? (
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            onClick={() => handleAction(result.userId, 'unban')}
                                                            disabled={actionLoading === result.userId}
                                                            className="h-8 text-xs border-white/10 hover:bg-white/5 active:bg-white/10"
                                                        >
                                                            {actionLoading === result.userId ? '...' : 'Unban'}
                                                        </Button>
                                                    ) : (
                                                        <>
                                                             <NeonButton 
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => handleAction(result.userId, 'kick')}
                                                                disabled={actionLoading === result.userId}
                                                                style={{ 
                                                                    height: '32px', 
                                                                    fontSize: '0.75rem', 
                                                                    padding: '0 1rem',
                                                                    borderColor: '#fbbf24',
                                                                    color: '#fbbf24',
                                                                    backgroundColor: 'rgba(251, 191, 36, 0.1)'
                                                                }}
                                                                glow={true}
                                                            >
                                                                {actionLoading === result.userId ? '...' : 'Kick'}
                                                            </NeonButton>
                                                            <NeonButton 
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => handleAction(result.userId, 'ban')}
                                                                disabled={actionLoading === result.userId}
                                                                style={{ height: '32px', fontSize: '0.75rem', padding: '0 1rem' }}
                                                            >
                                                                {actionLoading === result.userId ? '...' : 'Ban User'}
                                                            </NeonButton>
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </GlassPanel>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* User Details Modal */}
            <UserActionModal 
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                logEntry={{
                    userId: selectedUserForAction?.userId,
                    user: selectedUserForAction?.displayName,
                    action: selectedUserForAction?.action,
                    reason: selectedUserForAction?.reason,
                    timestamp: undefined, 
                    groupId: selectedGroup?.id 
                }}
                onActionComplete={() => {
                }}
            />
        </>,
        document.body
    );
};
