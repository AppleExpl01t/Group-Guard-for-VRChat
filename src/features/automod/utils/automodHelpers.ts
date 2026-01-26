// --- AutoMod Helper Utilities ---

/**
 * Get trust color based on user tags
 */
export const getTrustColor = (tags: string[]): string => {
    if (tags?.some(t => t.includes('trusted'))) return 'var(--color-trust-trusted)';
    if (tags?.some(t => t.includes('known'))) return 'var(--color-trust-known)';
    if (tags?.some(t => t.includes('user'))) return 'var(--color-trust-user)';
    if (tags?.some(t => t.includes('new_user'))) return 'var(--color-trust-basic)';
    return 'var(--color-trust-visitor)';
};

/**
 * Parse VRChat user tags into readable labels with colors
 */
export const parseUserTags = (tags: string[]): { label: string; color: string }[] => {
    if (!tags || !Array.isArray(tags)) return [];
    
    const result: { label: string; color: string }[] = [];
    
    // Trust levels
    if (tags.some(t => t === 'system_trust_veteran')) result.push({ label: 'trust veteran', color: 'rgba(168, 85, 247, 0.3)' });
    if (tags.some(t => t === 'system_trust_trusted')) result.push({ label: 'trust trusted', color: 'rgba(168, 85, 247, 0.3)' });
    if (tags.some(t => t === 'system_trust_known')) result.push({ label: 'trust known', color: 'rgba(249, 115, 22, 0.3)' });
    if (tags.some(t => t === 'system_trust_basic')) result.push({ label: 'trust basic', color: 'rgba(59, 130, 246, 0.3)' });
    
    // Special tags
    if (tags.some(t => t === 'system_early_adopter')) result.push({ label: 'early adopter', color: 'rgba(236, 72, 153, 0.3)' });
    if (tags.some(t => t === 'system_supporter')) result.push({ label: 'supporter', color: 'rgba(34, 197, 94, 0.3)' });
    if (tags.some(t => t.includes('feedback_access'))) result.push({ label: 'feedback access', color: 'rgba(99, 102, 241, 0.3)' });
    if (tags.some(t => t.includes('world_access'))) result.push({ label: 'world access', color: 'rgba(99, 102, 241, 0.3)' });
    if (tags.some(t => t.includes('avatar_access'))) result.push({ label: 'avatar access', color: 'rgba(99, 102, 241, 0.3)' });
    
    // Language
    const langTag = tags.find(t => t.startsWith('language_'));
    if (langTag) {
        const lang = langTag.replace('language_', '');
        result.push({ label: `language ${lang}`, color: 'rgba(156, 163, 175, 0.3)' });
    }
    
    return result;
};
