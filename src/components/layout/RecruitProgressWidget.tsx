
import React from 'react';
import { useRecruitStore } from '../../stores/recruitStore';
import { GlassPanel } from '../ui/GlassPanel';
import { Maximize2 } from 'lucide-react';

export const RecruitProgressWidget: React.FC = () => {
    const isActive = useRecruitStore(s => s.isActive);
    const minimized = useRecruitStore(s => s.minimized);
    const progress = useRecruitStore(s => s.progress);
    const restore = useRecruitStore(s => s.restore);
    // updateProgress removed from here

    // Global Listener removed - moved to AppLayout for stability
    
    // Only show if active AND minimized
    if (!isActive || !minimized) return null;

    const percent = progress.total > 0 
        ? Math.round(((progress.sent + progress.skipped + progress.failed) / progress.total) * 100) 
        : 0;

    return (
        <div style={{ 
            position: 'fixed', 
            bottom: '20px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 1000,
            cursor: 'pointer'
        }} onClick={restore}>
            <GlassPanel style={{ 
                padding: '10px 20px', 
                borderRadius: '30px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '15px',
                border: '1px solid var(--color-primary)',
                boxShadow: '0 0 15px rgba(0, 255, 242, 0.2)'
            }}>
                <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%', 
                    border: '3px solid var(--color-surface)',
                    borderTopColor: 'var(--color-primary)',
                    animation: 'spin 1s linear infinite'
                }} />
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--color-primary)' }}>
                        Smart Recruit Active
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                        {percent}% Complete ({progress.sent} sent)
                    </span>
                </div>

                <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />
                
                <Maximize2 size={18} color="var(--color-text-bright)" />
            </GlassPanel>
        </div>
    );
};
