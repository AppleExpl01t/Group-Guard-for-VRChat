/**
 * GroupAuthorizationService
 * 
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     CRITICAL SECURITY SERVICE                            ║
 * ║                                                                          ║
 * ║  ANY new feature that accepts a groupId MUST use this service!          ║
 * ║  See: .agent/workflows/security-requirements.md                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * This service enforces that ALL group-related API actions are only performed
 * on groups where the current user has verified moderation permissions.
 * 
 * SECURITY CONTRACT:
 * - Only groups returned by VRChat's getUserGroups API with moderation permissions are allowed
 * - All IPC handlers MUST call validateAccess() before performing any group action
 * - Unauthorized access attempts are logged for security auditing
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * import { groupAuthorizationService } from './GroupAuthorizationService';
 * 
 * ipcMain.handle('groups:new-feature', async (_event, { groupId }) => {
 *   // SECURITY: Always validate first!
 *   groupAuthorizationService.validateAccess(groupId, 'groups:new-feature');
 *   // ... your code here
 * });
 * ```
 */

import log from 'electron-log';
import { serviceEventBus } from './ServiceEventBus';
import { getVRChatClient } from './AuthService';
import Store from 'electron-store';
import { LRUCache } from 'lru-cache';

const logger = log.scope('GroupAuthorization');

// Moderation permission strings that indicate mod powers
const MODERATION_PERMISSIONS = [
    'group-bans-manage',
    'group-members-manage',
    // 'group-members-viewall', // Too broad - regular members often have this
    'group-members-remove',
    'group-data-manage',
    'group-audit-view',
    'group-join-request-manage',
    'group-instance-moderate',
    'group-instance-open',
    'group-instance-close'
];

interface GroupMembershipData {
    id: string;
    groupId?: string;
    ownerId?: string;
    userId?: string;
    roleIds?: string[];
    myMember?: { permissions?: string[]; roleIds?: string[] };
    group?: { ownerId?: string; name?: string };
    [key: string]: unknown;
}

class GroupAuthorizationService {
    // Set of group IDs where the user has moderation permissions
    private allowedGroupIds: Set<string> = new Set();

    // Cached FULL group objects for instant UI display (with images, names, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private cachedGroupObjects: Map<string, any> = new Map();

    // Persistent store for allowed groups (for instant startup)
    private store = new Store({ name: 'group-authorization-cache' });

    // Role cache to prevent redundant API calls
    // Key: groupId, Value: array of roles
    private roleCache = new LRUCache<string, any[]>({
        max: 200,
        ttl: 1000 * 60 * 60 * 24 // 24 hour TTL for roles
    });

    // Flag to track if permissions have been initialized
    private initialized: boolean = false;

    // Audit log of rejected access attempts
    private rejectionLog: Array<{
        timestamp: Date;
        groupId: string;
        action: string;
        reason: string;
    }> = [];

    // Predictive Caching
    private predictiveCacheInterval: NodeJS.Timeout | null = null;
    private predictiveCacheIndex: number = 0;

    // Owner ID of the cached groups
    private cacheOwnerId: string | null = null;

    constructor() {
        // Load allowed groups from disk for instant dashboard unlocking
        this.loadPersistedGroups();

        // Listen for raw group updates from GroupService (legacy support for event-based calls)
        serviceEventBus.on('groups-raw', async (payload) => {
            logger.info(`[SECURITY] Received groups-raw event with ${payload.groups?.length || 0} groups`);
            await this.processAndAuthorizeGroups(payload.groups || [], payload.userId);
        });
    }

    /**
     * Load allowed groups from persistent storage
     */
    private loadPersistedGroups(): void {
        try {
            const cached = this.store.get('allowedGroupIds') as string[];
            const ownerId = this.store.get('cacheOwnerId') as string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cachedObjects = this.store.get('cachedGroupObjects') as any[];

            if (Array.isArray(cached) && cached.length > 0) {
                this.allowedGroupIds = new Set(cached.filter(id => id && id.startsWith('grp_')));
                this.cacheOwnerId = ownerId || null;
                this.initialized = true;
                logger.info(`[SECURITY] Loaded ${this.allowedGroupIds.size} allowed groups from disk cache (Owner: ${this.cacheOwnerId})`);

                // Load full group objects if available
                if (Array.isArray(cachedObjects) && cachedObjects.length > 0) {
                    for (const g of cachedObjects) {
                        if (g?.id && g.id.startsWith('grp_')) {
                            this.cachedGroupObjects.set(g.id, g);
                        }
                    }
                    logger.info(`[SECURITY] Loaded ${this.cachedGroupObjects.size} full group objects from disk cache`);
                }

                // Emit event early to unlock UI
                serviceEventBus.emit('groups-cache-ready', { groupIds: Array.from(this.allowedGroupIds) });
            }
        } catch (e) {
            logger.warn('[SECURITY] Failed to load persisted groups:', e);
        }
    }

    /**
     * Persist allowed groups to disk
     */
    private persistGroups(): void {
        try {
            this.store.set('allowedGroupIds', Array.from(this.allowedGroupIds));
            this.store.set('cacheOwnerId', this.cacheOwnerId);
            // Also persist the full group objects for instant display on next startup
            this.store.set('cachedGroupObjects', Array.from(this.cachedGroupObjects.values()));
        } catch (e) {
            logger.error('[SECURITY] Failed to persist groups:', e);
        }
    }

    /**
     * Get cached full group objects (for Stage 1 instant display)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public getCachedGroupObjects(): any[] {
        return Array.from(this.cachedGroupObjects.values());
    }

    /**
     * Update the group object cache (called after Stage 2 refresh)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public updateGroupObjectCache(groups: any[]): void {
        for (const g of groups) {
            const id = g?.id || g?.groupId;
            if (id && id.startsWith('grp_')) {
                this.cachedGroupObjects.set(id, g);
            }
        }
        this.persistGroups();
    }


    // Track the active processing session to allow cancellation
    private currentProcessId: number = 0;

    /**
     * Process raw group memberships and determine which ones the user can moderate.
     * This is the core authorization logic - checking ownership or mod permissions.
     * 
     * @param groups Raw group membership data from VRChat API
     * @param userId The user ID to check permissions for
     * @returns Array of groups where the user has moderation permissions
     */
    public async processAndAuthorizeGroups(groups: GroupMembershipData[], userId: string): Promise<GroupMembershipData[]> {
        // Increment process ID to invalidate any conflicting previous runs
        const processId = ++this.currentProcessId;

        const client = getVRChatClient();
        const moderatableGroups: GroupMembershipData[] = [];

        if (!client || !userId) {
            logger.warn('[SECURITY] Cannot process groups: no client or userId');
            this.setAllowedGroups([]);
            return [];
        }

        // OPTIMIZATION: Prioritize owner groups first (no API calls needed)
        const ownerGroups: GroupMembershipData[] = [];
        const needsPermCheck: GroupMembershipData[] = [];

        for (const g of groups) {
            const groupId = g.groupId || g.id;
            if (!groupId || !groupId.startsWith('grp_')) {
                continue;
            }

            // Check if user is owner - no API call needed
            const isOwner = g.ownerId === userId || g.group?.ownerId === userId;
            if (isOwner) {
                ownerGroups.push(g);
            } else {
                needsPermCheck.push(g);
            }
        }

        // Add owner groups immediately
        moderatableGroups.push(...ownerGroups);
        logger.info(`[SECURITY] Found ${ownerGroups.length} owner groups (no API needed), ${needsPermCheck.length} need permission check`);

        // RATE LIMIT MITIGATION: Strict Serial Priority Queue
        // VRChat API is aggressive with rate limits on role fetching.
        // We must process one by one with a delay to avoid 429s.

        // 1. Process Priority Groups (User is Owner - Cached or simple check) which we already did above.
        // 2. Process High Priority Groups (First 3 in the list - "Fast Lane")
        const FAST_LANE_COUNT = 3;
        const fastLane = needsPermCheck.slice(0, FAST_LANE_COUNT);
        const slowLane = needsPermCheck.slice(FAST_LANE_COUNT);

        logger.info(`[SECURITY] Queue: ${fastLane.length} fast lane, ${slowLane.length} slow lane`);

        // Fast Lane Loop (Short delay)
        for (const g of fastLane) {
            // Check for cancellation
            if (this.currentProcessId !== processId) {
                logger.info(`[SECURITY] Process ${processId} cancelled by newer request`);
                return moderatableGroups;
            }

            const groupId = g.groupId || g.id;
            try {
                const hasMod = await this.checkModPermissions(groupId!, userId, g);
                if (hasMod) {
                    moderatableGroups.push(g);
                    this.emitGroupVerified(g);
                }
            } catch (e) {
                logger.error(`[SECURITY] Error checking permissions for ${groupId}:`, e);
            }
            await this.delay(500); // 500ms for fast lane
        }

        // Slow Lane Loop (Tortoise Mode - 2s delay)
        // This takes a long time (e.g. 150 groups * 2s = 5 mins)
        // But granular updates keep the UI alive.
        for (let i = 0; i < slowLane.length; i++) {
            // Check for cancellation
            if (this.currentProcessId !== processId) {
                logger.info(`[SECURITY] Process ${processId} cancelled by newer request (during slow lane)`);
                break;
            }

            const g = slowLane[i];
            const groupId = g.groupId || g.id;

            try {
                const hasMod = await this.checkModPermissions(groupId!, userId, g);
                if (hasMod) {
                    moderatableGroups.push(g);
                    this.emitGroupVerified(g);
                    logger.info(`[SECURITY] Checked ${groupId} (${i + 1}/${slowLane.length}): VERIFIED ✅`);
                } else {
                    logger.info(`[SECURITY] Checked ${groupId} (${i + 1}/${slowLane.length}): No Mod Perms ❌`);
                }
            } catch (e) {
                logger.error(`[SECURITY] Error checking permissions for ${groupId}:`, e);
            }

            // 5.5s delay between requests to appease the rate limit gods
            if (i < slowLane.length - 1) {
                await this.delay(5500);
            }
        }


        // Map the groups to ensure 'id' is the Group ID (grp_), not the Member ID (gmem_)
        const mappedGroups = moderatableGroups.map((g) => {
            if (g.groupId && typeof g.groupId === 'string' && g.groupId.startsWith('grp_')) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const groupObj = g as any;
                const innerGroup = groupObj.group || {};

                return {
                    ...g,
                    id: g.groupId,
                    _memberId: g.id,
                    name: innerGroup.name || g.group?.name || groupObj.name || 'Unknown Group',
                    // Ensure image URLs are extracted from the inner group object
                    iconUrl: innerGroup.iconUrl || groupObj.iconUrl,
                    iconId: innerGroup.iconId || groupObj.iconId,
                    bannerUrl: innerGroup.bannerUrl || groupObj.bannerUrl,
                    bannerId: innerGroup.bannerId || groupObj.bannerId,
                    shortCode: innerGroup.shortCode || groupObj.shortCode || '',
                    discriminator: innerGroup.discriminator || groupObj.discriminator,
                    onlineMemberCount: innerGroup.onlineMemberCount ?? groupObj.onlineMemberCount,
                    activeInstanceCount: innerGroup.activeInstanceCount ?? groupObj.activeInstanceCount
                };
            }
            return g;
        });

        // Set allowed groups (and owner)
        this.cacheOwnerId = userId;
        const groupIds = mappedGroups
            .map((g) => g.id || g.groupId)
            .filter((id): id is string => !!id && id.startsWith('grp_'));
        this.setAllowedGroups(groupIds);

        // Update the full group object cache for Stage 1 instant display on next startup
        this.updateGroupObjectCache(mappedGroups);
        // Note: persistGroups is called inside updateGroupObjectCache

        // Emit filtered groups for other services
        logger.info(`[SECURITY] Authorized ${mappedGroups.length} moderatable groups for user ${userId}`);
        serviceEventBus.emit('groups-updated', { groups: mappedGroups });

        return mappedGroups;
    }

    /**
     * Check if a user has moderation permissions in a group by checking their roles.
     */
    private async checkModPermissions(groupId: string, userId: string, membership: GroupMembershipData): Promise<boolean> {
        const client = getVRChatClient();
        if (!client) return false;

        // roleIds might be at top level, in myMember, or we need to fetch them
        let userRoleIds = membership.roleIds || membership.myMember?.roleIds || [];

        // If no roleIds in the membership response, fetch member record directly
        if (userRoleIds.length === 0) {
            try {
                const memberResp = await client.getGroupMember({
                    path: { groupId, userId }
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const memberRecord = (memberResp.data || memberResp) as any;

                if (memberRecord) {
                    userRoleIds = memberRecord.roleIds || [];
                }
            } catch (e) {
                logger.warn(`[SECURITY] Failed to fetch member record for group ${groupId}:`, e);
                return false;
            }
        }

        if (!userRoleIds || userRoleIds.length === 0) {
            return false;
        }

        // Fetch group roles and check for moderation permissions
        // Use retry with exponential backoff since VRChat returns garbage under rate limits
        const roles = await this.fetchRolesWithRetry(groupId, client);

        // If we couldn't get valid roles after retries, fail safely
        if (!roles) {
            logger.warn(`[SECURITY] Could not fetch valid roles for group ${groupId} after retries`);
            return false;
        }

        for (const roleId of userRoleIds) {
            const role = roles.find((r: { id?: string }) => r.id === roleId);
            if (role && role.permissions && Array.isArray(role.permissions)) {
                const hasModPerm = role.permissions.some((p: string) =>
                    MODERATION_PERMISSIONS.includes(p)
                );
                if (hasModPerm) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Fetch roles with retry and exponential backoff.
     * VRChat API returns garbage (empty objects, partial responses, HTML) under rate limits.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async fetchRolesWithRetry(groupId: string, client: any, attempt = 1): Promise<any[] | null> {
        const MAX_ATTEMPTS = 5;
        const BASE_DELAY = 300; // 300ms base delay

        // Check cache first
        const cached = this.roleCache.get(groupId);
        if (cached && Array.isArray(cached)) {
            return cached;
        }

        try {
            // Add delay between fetches to prevent rate limit storms
            // Delay increases with each attempt
            if (attempt > 1) {
                await this.delay(BASE_DELAY * attempt);
            }

            const rolesResponse = await client.getGroupRoles({ path: { groupId } });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const roles = (rolesResponse.data || rolesResponse) as any;

            // TYPE GUARD: VRChat sometimes returns garbage instead of 429
            if (!Array.isArray(roles)) {
                // Only log warning on final attempt to reduce spam
                if (attempt >= MAX_ATTEMPTS) {
                    logger.warn(`[SECURITY] Roles response for ${groupId} is not an array (FINAL ATTEMPT ${attempt}/${MAX_ATTEMPTS}): ${typeof roles}`);
                    return null;
                }

                logger.debug(`[SECURITY] Roles response for ${groupId} is not an array (attempt ${attempt}/${MAX_ATTEMPTS}), retrying...`);

                // Exponential backoff retry
                await this.delay(BASE_DELAY * Math.pow(2, attempt));
                return this.fetchRolesWithRetry(groupId, client, attempt + 1);
            }

            // Cache the valid response
            this.roleCache.set(groupId, roles);
            return roles;

        } catch (e) {
            logger.warn(`[SECURITY] Failed to fetch roles for group ${groupId} (attempt ${attempt}/${MAX_ATTEMPTS}):`, e);

            if (attempt >= MAX_ATTEMPTS) {
                return null;
            }

            // Exponential backoff retry on error
            await this.delay(BASE_DELAY * Math.pow(2, attempt));
            return this.fetchRolesWithRetry(groupId, client, attempt + 1);
        }
    }

    /**
     * Simple delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    /**
     * Updates the list of allowed groups.
     * Called by GroupService after fetching user's moderated groups.
     * 
     * @param groupIds Array of group IDs where user has moderation permissions
     */
    public setAllowedGroups(groupIds: string[]): void {
        this.allowedGroupIds = new Set(groupIds.filter(id => id && id.startsWith('grp_')));
        this.initialized = true;
        logger.info(`[SECURITY] Authorized groups updated: ${this.allowedGroupIds.size} groups allowed`);
        logger.debug(`[SECURITY] Allowed group IDs: ${Array.from(this.allowedGroupIds).join(', ')}`);
    }

    /**
     * Clears all allowed groups (used on logout)
     */
    public clearAllowedGroups(): void {
        this.allowedGroupIds.clear();
        this.cachedGroupObjects.clear();
        this.cacheOwnerId = null;
        this.initialized = false;

        // Force clear persistence
        this.store.clear();

        logger.info('[SECURITY] Authorized groups and cache CLEARED (logout or invalid owner)');
    }

    /**
     * Checks if the cached data belongs to the provided user ID.
     * 
     * @param userId The user ID to validate against the cache owner
     */
    public isCacheOwnedBy(userId: string): boolean {
        if (!this.cacheOwnerId) return false;
        // Simple case-insensitive check just to be safe
        return this.cacheOwnerId.trim() === userId.trim();
    }

    /**
     * Checks if a group ID is in the allowed list
     * 
     * @param groupId The group ID to check
     * @returns true if access is allowed, false otherwise
     */
    public isGroupAllowed(groupId: string): boolean {
        if (!groupId || !groupId.startsWith('grp_')) {
            return false;
        }
        return this.allowedGroupIds.has(groupId);
    }

    /**
     * Validates access to a group and throws if unauthorized.
     * This is the primary method that MUST be called by all IPC handlers.
     * 
     * @param groupId The group ID being accessed
     * @param action Description of the action being attempted (for logging)
     * @throws Error if access is denied
     */
    public validateAccess(groupId: string, action: string): void {
        // Validate group ID format
        if (!groupId || typeof groupId !== 'string') {
            const reason = 'Invalid group ID format (null or non-string)';
            this.logRejection(groupId, action, reason);
            throw new Error(`[SECURITY] Access Denied: ${reason}`);
        }

        if (!groupId.startsWith('grp_')) {
            const reason = `Invalid group ID format (must start with 'grp_'): ${groupId}`;
            this.logRejection(groupId, action, reason);
            throw new Error(`[SECURITY] Access Denied: ${reason}`);
        }

        // Check if authorized
        if (!this.allowedGroupIds.has(groupId)) {
            const reason = `User does not have moderation permissions for group: ${groupId}`;
            this.logRejection(groupId, action, reason);
            throw new Error(`[SECURITY] Access Denied: ${reason}`);
        }

        // Access granted - log for audit trail
        logger.debug(`[SECURITY] Access granted: ${action} on ${groupId}`);
    }

    /**
     * Validates access and returns a result object instead of throwing.
     * Use this when you need to handle rejection gracefully in the caller.
     * 
     * @param groupId The group ID being accessed
     * @param action Description of the action being attempted
     * @returns Object with success boolean and optional error message
     */
    public validateAccessSafe(groupId: string, action: string): { allowed: boolean; error?: string } {
        try {
            this.validateAccess(groupId, action);
            return { allowed: true };
        } catch (e) {
            const err = e as Error;
            return { allowed: false, error: err.message };
        }
    }

    /**
     * Get all currently allowed group IDs
     * 
     * @returns Array of allowed group IDs
     */
    public getAllowedGroupIds(): string[] {
        return Array.from(this.allowedGroupIds);
    }

    /**
     * Filters a list of data items to ensure they only belong to authorized groups.
     * Useful for cleaning API responses that might return data for groups the user
     * is in but doesn't have moderation permissions for.
     * 
     * @param items Array of data items to filter
     * @param groupIdExtractor Function to extract the group ID from an item
     * @returns Array containing only items belonging to authorized groups
     */
    public filterAuthorizedData<T>(items: T[], groupIdExtractor: (item: T) => string | undefined): T[] {
        if (!Array.isArray(items)) {
            return [];
        }

        const filtered = items.filter(item => {
            try {
                const groupId = groupIdExtractor(item);
                // If we can't extract a group ID, we assume it's not group-specific data
                // OR it's malformed. To be safe/strict as requested:
                if (!groupId) return false;

                return this.isGroupAllowed(groupId);
            } catch (e) {
                logger.error('[SECURITY] Error extracting group ID during filter:', e);
                return false;
            }
        });

        const removedCount = items.length - filtered.length;
        if (removedCount > 0) {
            logger.warn(`[SECURITY] Cleaned API data: Removed ${removedCount} items belonging to unauthorized groups.`);
        }

        return filtered;
    }

    /**
     * Check if the service has been initialized with group data
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get rejection audit log
     */
    public getRejectionLog(): ReadonlyArray<{
        timestamp: Date;
        groupId: string;
        action: string;
        reason: string;
    }> {
        return this.rejectionLog;
    }

    /**
     * Clear rejection log
     */
    public clearRejectionLog(): void {
        this.rejectionLog = [];
    }

    /**
     * Internal: Log a rejection for security auditing
     */
    private logRejection(groupId: string, action: string, reason: string): void {
        const entry = {
            timestamp: new Date(),
            groupId: groupId || 'null',
            action,
            reason
        };

        this.rejectionLog.push(entry);

        // Keep log from growing unbounded
        if (this.rejectionLog.length > 1000) {
            this.rejectionLog = this.rejectionLog.slice(-500);
        }

        logger.warn(`[SECURITY VIOLATION] Action: ${action} | Group: ${groupId} | Reason: ${reason}`);
    }
    /**
     * Internal: Emit a single group verified event
     */
    private emitGroupVerified(group: GroupMembershipData): void {
        try {
            const groupId = group.groupId || group.id;
            if (!groupId) return;

            // Normalize for emission similar to the bulk mapper
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const groupObj = group as any;
            const innerGroup = groupObj.group || {};

            const normalized = {
                ...group,
                id: groupId,
                _memberId: group.id,
                name: innerGroup.name || group.group?.name || groupObj.name || 'Unknown Group',
                iconUrl: innerGroup.iconUrl || groupObj.iconUrl,
                iconId: innerGroup.iconId || groupObj.iconId,
                bannerUrl: innerGroup.bannerUrl || groupObj.bannerUrl,
                bannerId: innerGroup.bannerId || groupObj.bannerId,
                shortCode: innerGroup.shortCode || groupObj.shortCode || '',
                discriminator: innerGroup.discriminator || groupObj.discriminator,
                onlineMemberCount: innerGroup.onlineMemberCount ?? groupObj.onlineMemberCount,
                activeInstanceCount: innerGroup.activeInstanceCount ?? groupObj.activeInstanceCount
            };

            serviceEventBus.emit('group-verified', { group: normalized });
        } catch (e) {
            logger.warn('[SECURITY] Failed to emit granular update:', e);
        }
    }

    /**
     * PREDICTIVE CACHING
     * Automatically fetches roles for allowed groups in the background/idle time.
     * This ensures that when a user clicks a group, the roles are likely already in LRU cache.
     */
    public startPredictiveCaching(): void {
        if (this.predictiveCacheInterval) return;

        logger.info('[PERF] Starting predictive caching service');

        // Run every 2 minutes (low priority)
        this.predictiveCacheInterval = setInterval(() => {
            this.runPredictiveCacheCycle().catch(err => {
                logger.warn('[PERF] Predictive cache cycle failed', err);
            });
        }, 1000 * 60 * 2);

        // Run first cycle after 30s delay to let startup settle
        setTimeout(() => {
            this.runPredictiveCacheCycle().catch(() => { });
        }, 30000);
    }

    public stopPredictiveCaching(): void {
        if (this.predictiveCacheInterval) {
            clearInterval(this.predictiveCacheInterval);
            this.predictiveCacheInterval = null;
        }
    }

    private async runPredictiveCacheCycle(): Promise<void> {
        const allowedIds = Array.from(this.allowedGroupIds);
        if (allowedIds.length === 0) return;

        // Process a few groups per cycle
        const PROCESS_PER_CYCLE = 3;
        const client = getVRChatClient();
        if (!client) return;

        logger.debug(`[PERF] Running predictive cache cycle. Total groups: ${allowedIds.length}`);

        for (let i = 0; i < PROCESS_PER_CYCLE; i++) {
            // Round-robin
            this.predictiveCacheIndex = (this.predictiveCacheIndex + 1) % allowedIds.length;
            const groupId = allowedIds[this.predictiveCacheIndex];

            // Only fetch if NOT in cache or nearing expiry (LRU doesn't tell us expiry easily, but we can check existence)
            // Actually, fetchRolesWithRetry checks cache internaly. 
            // We want to force a refresh if it's been a while, but LRU handles that.
            // However, our fetchRolesWithRetry returns cached data if present.
            // To force predictive refresh, we might need to be smarter, OR just rely on LRU expiry.
            // If LRU ttl is 24h, we don't need to refresh often.
            // BUT, if the user gains NEW permissions, we want to know.

            // For now, let's just peek. If it's missing, we fetch.
            if (!this.roleCache.has(groupId)) {
                logger.debug(`[PERF] Pre-fetching roles for ${groupId}`);
                await this.fetchRolesWithRetry(groupId, client);
                await this.delay(1000); // 1s delay between predictive fetches (very low priority)
            }
        }
    }
}

// Singleton export
export const groupAuthorizationService = new GroupAuthorizationService();
