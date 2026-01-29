import React, { useMemo } from 'react';
import { useInstanceMonitorStore } from '../../../stores/instanceMonitorStore';

interface LivePlayerChartProps {
    className?: string;
    style?: React.CSSProperties;
}

export const LivePlayerChart: React.FC<LivePlayerChartProps> = ({ className, style }) => {
    const history = useInstanceMonitorStore(state => state.history);

    // Filter data to only show since join (or last 60 minutes for scalability?) 
    // User asked for "since you have joined", which is what history contains.

    const { pathD, fillD, maxY, minY, minX, maxX } = useMemo(() => {
        if (!history || history.length < 2) return { pathD: '', fillD: '', maxY: 40, minY: 0, minX: 0, maxX: 0 };

        const counts = history.map(h => h.count);

        // Dynamic Y Axis
        // User asked for dynamic scaling. Zoom in on the variance.
        const lowest = Math.min(...counts);
        let yMin = Math.max(0, lowest - 2);
        let yMax = Math.max(...counts, yMin + 5); // Ensure at least 5 range
        const yRange = yMax - yMin;

        // Dynamic X Axis
        const startTime = history[0].timestamp;
        const endTime = history[history.length - 1].timestamp;
        // Ensure at least 60 seconds range for visuals if mostly empty
        const xMin = startTime;
        const xMax = Math.max(endTime, startTime + 60000);
        const xRange = xMax - xMin;

        // Define chart dimensions (viewBox)
        const width = 300;
        const height = 100;
        const padding = 10; // More padding for labels

        const points = history.map(h => {
            // Scale X
            const x = padding + ((h.timestamp - xMin) / xRange) * (width - (padding * 2));

            // Scale Y
            const y = (height - padding) - ((h.count - yMin) / yRange) * (height - (padding * 2));

            return `${x},${y}`;
        }).join(' ');

        // For Area fill
        const firstPoint = points.split(' ')[0];
        const lastPoint = points.split(' ')[points.split(' ').length - 1];
        const fillPath = `${firstPoint.split(',')[0]},${height - padding} ${points} ${lastPoint.split(',')[0]},${height - padding}`;

        return {
            pathD: `M ${points}`,
            fillD: `M ${fillPath} Z`,
            maxY: yMax,
            minY: yMin,
            minX: xMin,
            maxX: xMax
        };
    }, [history]);

    // Format helpers
    const formatTime = (ms: number) => {
        const d = new Date(ms);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!history || history.length === 0) {
        return (
            <div className={className} style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-dim)',
                fontSize: '0.8rem',
                height: '100px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px'
            }}>
                WAITING FOR DATA...
            </div>
        );
    }

    return (
        <div className={className} style={{ ...style, position: 'relative', overflow: 'hidden', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ position: 'absolute', top: 5, left: 10, fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 'bold', zIndex: 2 }}>
                LIVE TRAFFIC
            </div>

            <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Area Fill */}
                <path d={fillD} fill="url(#chartGradient)" stroke="none" />

                {/* Line */}
                <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />

                {/* Cursor Dot (Latest) */}
                {history.length > 0 && (
                    <circle
                        cx="100%" // CSS hack? No, won't work in SVG. Need calc.
                    // Actually the last point is calculated in JS.
                    // Ideally we'd map "current" to the last point coords.
                    // But let's just let the line end.
                    />
                )}
            </svg>

            {/* Axis Labels */}
            <div style={{ position: 'absolute', bottom: 2, left: 10, fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>
                {formatTime(minX)}
            </div>
            <div style={{ position: 'absolute', bottom: 2, right: 10, fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>
                {formatTime(maxX)}
            </div>
            <div style={{ position: 'absolute', top: 5, right: 10, fontSize: '0.65rem', color: 'var(--color-primary)' }}>
                MAX: {maxY}
            </div>
            {minY > 0 && (
                <div style={{ position: 'absolute', bottom: 15, right: 10, fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>
                    MIN: {minY}
                </div>
            )}
        </div>
    );
};
