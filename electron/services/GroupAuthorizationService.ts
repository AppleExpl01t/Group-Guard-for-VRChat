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

const logger = log.scope('GroupAuthorization');

class GroupAuthorizationService {
    // Set of group IDs where the user has moderation permissions
    private allowedGroupIds: Set<string> = new Set();
    
    // Flag to track if permissions have been initialized
    private initialized: boolean = false;
    
    // Audit log of rejected access attempts
    private rejectionLog: Array<{
        timestamp: Date;
        groupId: string;
        action: string;
        reason: string;
    }> = [];

    constructor() {
        // Listen for group updates from GroupService
        serviceEventBus.on('groups-updated', (payload) => {
             logger.info(`[SECURITY] Received groups-updated event with ${payload.groups?.length || 0} groups`);
             // Debug: Log raw group data to identify mapping issues
             payload.groups?.forEach((g: { id?: string; groupId?: string; name?: string }, i: number) => {
                 logger.debug(`[SECURITY] Group ${i}: id=${g.id}, groupId=${g.groupId}, name=${g.name}`);
             });
             const groupIds = payload.groups
                 .map((g: { id?: string }) => g.id)
                 .filter((id): id is string => !!id);
             logger.info(`[SECURITY] Extracted group IDs: ${JSON.stringify(groupIds)}`);
             this.setAllowedGroups(groupIds);
        });
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
        this.initialized = false;
        logger.info('[SECURITY] Authorized groups cleared (logout)');
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
}

// Singleton export
export const groupAuthorizationService = new GroupAuthorizationService();
