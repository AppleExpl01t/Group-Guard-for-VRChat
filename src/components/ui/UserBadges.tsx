import React from 'react';
import { getTrustColor } from '../../features/automod/utils/automodHelpers';

interface TrustRankBadgeProps {
    tags?: string[];
    fallbackRank?: string; // e.g., from 'rank' field if available
}

export const TrustRankBadge: React.FC<TrustRankBadgeProps> = ({ tags, fallbackRank }) => {
    if (!tags) {
        if (!fallbackRank) return null;
        // If we only have a raw rank string, try to color it
        let color = '#cccccc'; // Visitor (Grey)
        const lower = fallbackRank.toLowerCase();

        if (lower.includes('unknown')) color = '#cccccc'; // Explicitly handle Unknown
        else if (lower.includes('veteran') || lower.includes('legend')) color = '#ffd700'; // Gold/Legend (or Purple if User prefers)
        else if (lower.includes('trust') || lower.includes('purple')) color = '#8142f5'; // Trusted (Purple)
        else if (lower.includes('known') || lower.includes('orange')) color = '#ff7b00'; // Known (Orange)
        else if (lower.includes('new') || lower.includes('blue')) color = '#1778ff'; // New (Blue) - Check BEFORE User
        else if (lower.includes('user') || lower.includes('green')) color = '#2bcf5c'; // User (Green)

        return (
            <span style={{
                color: color,
                fontSize: '0.65rem',
                fontWeight: 700,
                border: `1px solid ${color}`,
                padding: '0.1rem 0.3rem',
                borderRadius: '4px',
                textTransform: 'uppercase',
                marginLeft: '0.5rem',
                letterSpacing: '0.05em'
            }}>
                {fallbackRank}
            </span>
        );

        return (
            <span style={{
                color: color,
                fontSize: '0.65rem',
                fontWeight: 700,
                border: `1px solid ${color}`,
                padding: '0.1rem 0.3rem',
                borderRadius: '4px',
                textTransform: 'uppercase',
                marginLeft: '0.5rem',
                letterSpacing: '0.05em'
            }}>
                {fallbackRank}
            </span>
        );
    }

    const color = getTrustColor(tags);
    let label = 'Visitor';

    // Determine label from tags same way as color
    if (tags.some(t => t.includes('system_trust_legend'))) label = 'Legend';
    else if (tags.some(t => t.includes('system_trust_veteran'))) label = 'Trusted';
    else if (tags.some(t => t.includes('system_trust_trusted'))) label = 'Known';
    else if (tags.some(t => t.includes('system_trust_known'))) label = 'User';
    else if (tags.some(t => t.includes('system_trust_basic'))) label = 'New User';

    return (
        <span style={{
            color: color,
            fontSize: '0.65rem',
            fontWeight: 700,
            border: `1px solid ${color}`,
            padding: '0.1rem 0.3rem',
            borderRadius: '4px',
            textTransform: 'uppercase',
            marginLeft: '0.5rem',
            letterSpacing: '0.05em',
            display: 'inline-flex',
            alignItems: 'center',
            height: '16px'
        }}>
            {label}
        </span>
    );
};

export const AgeVerifiedBadge: React.FC<{ isVerified?: boolean }> = ({ isVerified }) => {
    if (!isVerified) return null;

    return (
        <span
            title="18+ Verified"
            style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                border: '1px solid #ef4444',
                fontSize: '0.6rem',
                fontWeight: 800,
                borderRadius: '3px',
                padding: '0 0.2rem',
                marginRight: '0.4rem',
                display: 'inline-flex',
                alignItems: 'center',
                height: '16px',
                cursor: 'help'
            }}
        >
            18+
        </span>
    );
};

export const VRCPlusBadge: React.FC<{ isVRCPlus?: boolean }> = ({ isVRCPlus }) => {
    if (!isVRCPlus) return null;

    return (
        <span
            title="VRC+ Subscriber"
            style={{
                background: 'rgba(255, 215, 0, 0.15)',
                color: '#ffd700',
                border: '1px solid #ffd700',
                fontSize: '0.55rem',
                fontWeight: 800,
                borderRadius: '3px',
                padding: '0 0.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                height: '16px',
                cursor: 'help'
            }}
        >
            VRC+
        </span>
    );
};

export const UserBadges: React.FC<{ tags?: string[]; isAgeVerified?: boolean; id?: string }> = ({ tags, isAgeVerified }) => {
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <AgeVerifiedBadge isVerified={isAgeVerified} />
            <TrustRankBadge tags={tags} />
        </div>
    );
};
