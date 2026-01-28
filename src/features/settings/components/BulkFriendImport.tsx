/**
 * BulkFriendImport Component
 * 
 * Debug tool for importing friends from a VRCX JSON export
 * and sending friend requests to all users.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NeonButton } from '../../../components/ui/NeonButton';
import { Upload, Play, X, CheckCircle, AlertCircle } from 'lucide-react';

interface BulkFriendProgress {
    sent: number;
    skipped: number;
    failed: number;
    total: number;
    current?: string;
    done?: boolean;
}

interface SelectedFile {
    path: string;
    count: number;
    preview: string[];
}

export const BulkFriendImport: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<BulkFriendProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

    // Subscribe to progress events
    useEffect(() => {
        const unsubscribe = window.electron.debug.onBulkFriendProgress((data) => {
            setProgress(data);
            if (data.done) {
                setIsRunning(false);
                setResult({ sent: data.sent, failed: data.failed, skipped: data.skipped });
            }
        });
        return unsubscribe;
    }, []);

    const handleSelectFile = useCallback(async () => {
        setError(null);
        setResult(null);
        const res = await window.electron.debug.selectFriendJson();
        if (res.success && res.path && res.count !== undefined) {
            setSelectedFile({
                path: res.path,
                count: res.count,
                preview: res.preview || []
            });
        } else if (res.error) {
            setError(res.error);
        }
    }, []);

    const handleStart = useCallback(async () => {
        if (!selectedFile) return;
        setError(null);
        setResult(null);
        setIsRunning(true);
        setProgress({ sent: 0, skipped: 0, failed: 0, total: selectedFile.count });

        const res = await window.electron.debug.bulkFriendFromJson(selectedFile.path, 1500);
        
        if (!res.success) {
            setError(res.error || 'Unknown error');
            setIsRunning(false);
        }
        // Result will come through progress event with done=true
    }, [selectedFile]);

    const handleCancel = useCallback(() => {
        // Note: Cancel is not implemented on backend, but we can hide the UI
        setIsRunning(false);
        setProgress(null);
    }, []);

    const handleReset = useCallback(() => {
        setSelectedFile(null);
        setProgress(null);
        setResult(null);
        setError(null);
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* File Selection */}
            {!selectedFile && !isRunning && (
                <NeonButton
                    variant="secondary"
                    onClick={handleSelectFile}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Upload size={16} />
                    Select JSON File
                </NeonButton>
            )}

            {/* Selected File Info */}
            {selectedFile && !isRunning && !result && (
                <div style={{ 
                    background: 'var(--color-surface-card)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ color: 'var(--color-text-main)', fontWeight: 500 }}>
                                {selectedFile.count} users found
                            </div>
                            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                {selectedFile.path.split(/[\\/]/).pop()}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <NeonButton variant="primary" onClick={handleStart}>
                                <Play size={14} style={{ marginRight: '0.25rem' }} />
                                Start
                            </NeonButton>
                            <NeonButton variant="ghost" onClick={handleReset}>
                                <X size={14} />
                            </NeonButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress */}
            {isRunning && progress && (
                <div style={{ 
                    background: 'var(--color-surface-card)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ color: 'var(--color-text-main)', fontWeight: 500 }}>
                            Sending friend requests...
                        </div>
                        <NeonButton variant="ghost" size="sm" onClick={handleCancel}>
                            Cancel
                        </NeonButton>
                    </div>
                    
                    {/* Progress bar */}
                    <div style={{ 
                        height: '4px', 
                        background: 'var(--border-color)', 
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '0.5rem'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${progress.total > 0 ? ((progress.sent + progress.failed) / progress.total) * 100 : 0}%`,
                            background: 'var(--color-primary)',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                        <span style={{ color: 'var(--color-success)' }}>✓ {progress.sent} sent</span>
                        <span style={{ color: 'var(--color-warning)' }}>⊘ {progress.skipped} skipped</span>
                        <span style={{ color: 'var(--color-error)' }}>✗ {progress.failed} failed</span>
                        <span>/ {progress.total} total</span>
                    </div>

                    {progress.current && (
                        <div style={{ color: 'var(--color-text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            Current: {progress.current}
                        </div>
                    )}
                </div>
            )}

            {/* Result */}
            {result && (
                <div style={{ 
                    background: 'var(--color-surface-card)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${result.failed > 0 ? 'var(--color-warning)' : 'var(--color-success)'}`
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {result.failed > 0 ? (
                            <AlertCircle size={18} style={{ color: 'var(--color-warning)' }} />
                        ) : (
                            <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
                        )}
                        <span style={{ color: 'var(--color-text-main)', fontWeight: 500 }}>
                            Complete
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                        <span style={{ color: 'var(--color-success)' }}>✓ {result.sent} sent</span>
                        <span style={{ color: 'var(--color-warning)' }}>⊘ {result.skipped} already friends</span>
                        <span style={{ color: 'var(--color-error)' }}>✗ {result.failed} failed</span>
                    </div>
                    <NeonButton variant="ghost" size="sm" onClick={handleReset} style={{ marginTop: '0.5rem' }}>
                        Import Another
                    </NeonButton>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ 
                    color: 'var(--color-error)', 
                    fontSize: '0.85rem',
                    padding: '0.5rem',
                    background: 'rgba(255, 100, 100, 0.1)',
                    borderRadius: '4px'
                }}>
                    {error}
                </div>
            )}
        </div>
    );
};
