import React, { useEffect, useState } from 'react';
import { Activity, Database, Users, Clock } from 'lucide-react';
import { useInstanceMonitorStore } from '../../../stores/instanceMonitorStore';

interface InternalHealthStats {
    enrichmentQueue: number;
    isEnriching: boolean;
}

interface InstanceHealthWidgetProps {
    style?: React.CSSProperties;
    className?: string;
}

export const InstanceHealthWidget: React.FC<InstanceHealthWidgetProps> = ({ style, className }) => {
    const liveScanResults = useInstanceMonitorStore(state => state.liveScanResults);
    const players = useInstanceMonitorStore(state => state.players);
    const [stats, setStats] = useState<InternalHealthStats | null>(null);
    const [joinRate, setJoinRate] = useState<number>(0);

    // Poll for backend stats (Queue size)
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await window.electron.instance.getHealthStats();
                if (res.success && res.stats) {
                    setStats(res.stats);
                }
            } catch (e) {
                console.error("Failed to health stats", e);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 2000);
        return () => clearInterval(interval);
    }, []);

    // Calculate Join Rate (Players joined in last 60s)
    useEffect(() => {
        const now = Date.now();
        const recentJoins = Object.values(players).filter(p => (now - p.joinTime) < 60000).length;
        setJoinRate(recentJoins);
    }, [players]); // Re-run when players list changes

    const activeCount = liveScanResults.filter(e => e.status === 'active').length;
    const processingCount = liveScanResults.filter(e => e.rank === 'Unknown' && e.status === 'active').length;

    return (
        <div
            className={className}
            style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                background: 'rgba(0,0,0,0.3)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.9rem',
                color: 'var(--color-text-dim)',
                ...style
            }}
        >
            <div title="Active / Total Players" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.8 }}>
                    <Users size={14} />
                    <span>ACTIVE</span>
                </div>
                <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', fontSize: '1.1rem' }}>{activeCount}</span>
            </div>

            <div title="Join Rate (Last 60s)" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.8 }}>
                    <Clock size={14} />
                    <span>RATE</span>
                </div>
                <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', fontSize: '1.1rem' }}>{joinRate}/m</span>
            </div>

            <div title="Enrichment Queue" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.8 }}>
                    <Activity size={14} color={stats?.isEnriching ? '#fde047' : 'inherit'} />
                    <span>QUEUE</span>
                </div>
                <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', fontSize: '1.1rem' }}>{stats?.enrichmentQueue || 0}</span>
            </div>

            <div title="Pending Scans" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.8 }}>
                    <Database size={14} color={processingCount > 0 ? '#fca5a5' : '#86efac'} />
                    <span>PENDING</span>
                </div>
                <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', fontSize: '1.1rem' }}>{processingCount}</span>
            </div>
        </div>
    );
};
