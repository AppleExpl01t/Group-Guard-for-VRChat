/**
 * EntityEnrichmentService
 * 
 * Handles background fetching and caching of VRChat user details.
 * Provides enrichment data (trust rank, avatar, group membership) for instance scanning.
 */

import log from 'electron-log';
import { LRUCache } from 'lru-cache';
import { getVRChatClient } from './AuthService';
import { databaseService } from './DatabaseService';
import { windowService } from './WindowService';

const logger = log.scope('EntityEnrichmentService');

// ============================================
// TRUST RANK UTILITIES (Consolidated from TrustRankService.ts)
// ============================================

// Trust rank levels in order from lowest to highest
export const TRUST_RANKS = [
    'Visitor',
    'New User',  // Was 'User'
    'User',      // Was 'Known'
    'Known',     // Was 'Trusted'
    'Trusted',   // Was 'Veteran'
    'Veteran',   // Wait, VRChat is Visitor -> New User -> User -> Known User -> Trusted User.
    'Legend'
] as const;

export type TrustRank = typeof TRUST_RANKS[number] | 'Unknown';

// Tag to rank mapping
const TRUST_TAG_MAP: Record<string, TrustRank> = {
    'system_trust_visitor': 'Visitor',
    'system_trust_basic': 'New User',  // Blue
    'system_trust_known': 'User',      // Green
    'system_trust_trusted': 'Known',   // Orange
    'system_trust_veteran': 'Trusted', // Purple
    'system_trust_legend': 'Legend'   // Gold/Legend
};

// Ordered tags from highest to lowest (for priority matching)
const TRUST_TAGS_ORDERED = [
    'system_trust_legend',
    'system_trust_veteran',
    'system_trust_trusted',
    'system_trust_known',
    'system_trust_basic',
    'system_trust_visitor'
];

/**
 * Get trust rank from user tags array.
 * Returns the highest applicable trust rank, or 'Unknown' if no trust tags found.
 */
export function getTrustRank(tags: string[] | undefined): TrustRank {
    if (!tags || tags.length === 0) {
        return 'Unknown';
    }

    // Check from highest to lowest - return first match
    for (const tag of TRUST_TAGS_ORDERED) {
        if (tags.includes(tag)) {
            return TRUST_TAG_MAP[tag];
        }
    }

    return 'Unknown';
}

/**
 * Get the index of a trust rank for comparison purposes.
 * Higher index = higher trust.
 * Returns -1 for 'Unknown'.
 */
export function getTrustRankIndex(rank: TrustRank): number {
    if (rank === 'Unknown') return -1;
    return TRUST_RANKS.indexOf(rank as typeof TRUST_RANKS[number]);
}

/**
 * Check if a user's trust level meets a minimum requirement.
 */
export function meetsMinimumTrust(userTags: string[] | undefined, minRank: TrustRank): boolean {
    const userRank = getTrustRank(userTags);
    const userIndex = getTrustRankIndex(userRank);
    const minIndex = getTrustRankIndex(minRank);

    // Unknown users (-1) never meet any requirement
    if (userIndex < 0) return false;

    return userIndex >= minIndex;
}

/**
 * Get the trust tag that corresponds to a rank name.
 */
export function getTrustTagForRank(rank: TrustRank): string | null {
    for (const [tag, tagRank] of Object.entries(TRUST_TAG_MAP)) {
        if (tagRank === rank) return tag;
    }
    return null;
}

// ============================================
// TYPES
// ============================================

import { friendshipService } from './FriendshipService';

// ... (existing imports)

// ...

export interface LiveEntity {
    id: string; // userId (usr_...)
    displayName: string;
    rank: string; // 'Visitor' | 'User' | 'Known' | 'Trusted' | 'Veteran' | 'Legend' | 'Unknown'
    isGroupMember: boolean;
    status: 'active' | 'kicked' | 'joining';
    avatarUrl?: string;
    lastUpdated: number;
    // New Fields
    friendStatus?: 'friend' | 'outgoing' | 'incoming' | 'none';
    friendScore?: number;
    metrics?: {
        encounters: number;
        timeSpent: number;
    };
    isAgeVerified?: boolean;
}

// ...

// Inside processFetchQueue, around line 240
// Update Cache logic



// ============================================
// CACHE (LRU to prevent memory leaks)
// ============================================

const entityCache = new LRUCache<string, LiveEntity>({
    max: 5000,
    ttl: 1000 * 60 * 60 * 2, // 2 hours TTL
    updateAgeOnGet: true
});

// Rate limit helper
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Queue for background fetching to avoid 429s
const fetchQueue: string[] = [];
let isFetching = false;

// Track current context for the queue processor
const currentEnrichmentContext: { groupId?: string } = {};

// ============================================
// PUBLIC API
// ============================================

/**
 * Get cached entity by cache key
 */
export function getCachedEntity(cacheKey: string): LiveEntity | undefined {
    return entityCache.get(cacheKey);
}

/**
 * Check if entity exists in cache
 */
export function hasCachedEntity(cacheKey: string): boolean {
    return entityCache.has(cacheKey);
}

/**
 * Store entity in cache
 */
export function setCachedEntity(cacheKey: string, entity: LiveEntity): void {
    entityCache.set(cacheKey, entity);
}

/**
 * Generate cache key for a user
 */
export function makeCacheKey(userId: string, groupId?: string): string {
    return groupId ? `${groupId}:${userId}` : `roam:${userId}`;
}

/**
 * Queue a user for enrichment (fetching details from API)
 */
export function queueUserEnrichment(userId: string, groupId?: string): void {
    if (!fetchQueue.includes(userId)) {
        fetchQueue.push(userId);
    }

    // Store context for processor
    if (groupId) {
        currentEnrichmentContext.groupId = groupId;
    }

    // Trigger background processor
    processFetchQueue(groupId);
}

/**
 * Process pending enrichment queue
 */
export async function processFetchQueue(groupId?: string): Promise<void> {
    if (isFetching || fetchQueue.length === 0) return;
    isFetching = true;

    const client = getVRChatClient();
    if (!client) {
        isFetching = false;
        return;
    }

    try {
        while (fetchQueue.length > 0) {
            const userId = fetchQueue.shift();
            if (!userId) continue;

            const cacheKey = makeCacheKey(userId, groupId);

            // Double check cache before hitting API
            const existing = entityCache.get(cacheKey);
            if (existing && existing.rank !== 'Unknown') {
                continue;
            }

            logger.info(`[EntityEnrichment] Fetching details for ${userId} (Context: ${groupId || 'Roaming'})...`);

            try {
                // 1. Get User Details (Rank, Avatar) - Using Central Service Cache
                // Dynamically import to avoid circular dependencies if they exist (safe pattern)
                const { vrchatApiService } = await import('./VRChatApiService');
                const userRes = await vrchatApiService.getUser(userId);

                if (!userRes.success || !userRes.data) {
                    throw new Error(userRes.error || 'Failed to fetch user');
                }
                const userData = userRes.data;

                // 2. Check Group Membership (Only if groupId provided)
                let isMember = false;
                if (groupId) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (client as any).getGroupMember({ path: { groupId, userId } });
                        isMember = true;
                    } catch {
                        // 404 = not a member
                        isMember = false;
                    }
                }

                // Update Cache
                const displayName = userData?.displayName || 'Unknown';
                const tags = userData?.tags || [];

                // Use centralized trust rank service
                const rank = getTrustRank(tags);

                // Fetch Friendship Data
                const friendDetails = await friendshipService.getFriendshipDetails(userId);

                const entity: LiveEntity = {
                    id: userId,
                    displayName,
                    rank,
                    isGroupMember: isMember,
                    status: 'active',
                    // Prioritize persistent profile pictures (userIcon via VRC+) over current avatar thumbnail
                    avatarUrl: userData?.userIcon || userData?.profilePicOverride || userData?.currentAvatarThumbnailImageUrl || '',
                    lastUpdated: Date.now(),
                    friendStatus: friendDetails.isFriend ? 'friend' : 'none',
                    friendScore: friendDetails.score,
                    isAgeVerified: tags.includes('system_age_verified_group') || (userData as any).ageVerificationStatus === '18+'
                };

                entityCache.set(cacheKey, entity);

                // Persist to database for searchability
                databaseService.upsertScannedUser({
                    id: userId,
                    displayName,
                    rank,
                    thumbnailUrl: entity.avatarUrl,
                    groupId: groupId
                }).catch(err => logger.warn(`Failed to persist scanned user ${userId}:`, err));

                // Emit update to UI
                windowService.broadcast('instance:entity-update', entity);

                // PERSIST DETAILS TO DISK (SESSION DB)
                try {
                    // Dynamic import to avoid circular dependency
                    const { instanceLoggerService } = await import('./InstanceLoggerService');

                    instanceLoggerService.logEnrichedEvent('PLAYER_DETAILS', {
                        userId: entity.id,
                        displayName: entity.displayName,
                        rank: entity.rank,
                        isGroupMember: entity.isGroupMember,
                        timestamp: new Date().toISOString()
                    });
                } catch (e) {
                    logger.error('[EntityEnrichment] Failed to persist enriched details', e);
                }

            } catch (err) {
                logger.warn(`[EntityEnrichment] Failed to fetch data for ${userId}`, err);
            }

            // Respect rate limits!
            await sleep(500);
        }
    } catch (e) {
        logger.error('[EntityEnrichment] Queue processor fatal error', e);
    } finally {
        isFetching = false;
        // Check if more came in
        if (fetchQueue.length > 0) processFetchQueue(groupId);
    }
}

/**
 * Clear all cached entities
 */
export function clearEntityCache(): void {
    entityCache.clear();
}

/**
 * Get queue status for debugging
 */
export function getQueueStatus(): { queueLength: number; isFetching: boolean; cacheSize: number } {
    return {
        queueLength: fetchQueue.length,
        isFetching,
        cacheSize: entityCache.size
    };
}

// Export singleton-style service object for consistency
export const entityEnrichmentService = {
    getCachedEntity,
    hasCachedEntity,
    setCachedEntity,
    makeCacheKey,
    queueUserEnrichment,
    processFetchQueue,
    clearEntityCache,
    getQueueStatus
};
