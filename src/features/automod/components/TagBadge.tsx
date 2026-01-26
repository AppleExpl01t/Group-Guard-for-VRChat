import React from 'react';

interface TagBadgeProps {
    label: string;
    color?: string;
}

export const TagBadge: React.FC<TagBadgeProps> = ({ label, color = 'rgba(255,255,255,0.1)' }) => (
    <span style={{
        padding: '4px 10px',
        background: color,
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 600,
        color: 'white',
        textTransform: 'lowercase',
        whiteSpace: 'nowrap'
    }}>
        {label}
    </span>
);
