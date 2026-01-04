import { ipcMain } from 'electron';
import log from 'electron-log';
import { getVRChatClient, getCurrentUserId } from './AuthService';

export function setupGroupHandlers() {

  // Get user's groups (groups where user is a member)
  ipcMain.handle('groups:get-my-groups', async () => {
    try {
      const client = getVRChatClient();
      const userId = getCurrentUserId();
      
      log.debug('groups:get-my-groups called', { hasClient: !!client, userId });
      
      if (!client || !userId) {
        log.warn('Auth check failed in GroupService');
        throw new Error("Not authenticated. Please log in first.");
      }

      log.info(`Fetching user groups for user ID: "${userId}" (type: ${typeof userId})`);
      
      // Sanitize userId
      const safeUserId = userId.trim();
      if (!safeUserId.startsWith('usr_')) {
          log.error(`Invalid User ID format: ${safeUserId}`);
          throw new Error(`Invalid User ID: ${safeUserId}`);
      }
      
      // Reverting to Object Syntax as positional caused "malformed url"
      const response = await client.getUserGroups({ 
        path: { userId: safeUserId },
        query: { n: 100, offset: 0 }
      });

      if (response.error) {
        log.error('getUserGroups returned error:', response.error);
        throw new Error((response.error as { message?: string }).message || 'Failed to fetch groups');
      }

      const groups = response.data || [];
      
      // Filter for groups where user has moderation powers
      const moderatableGroups = groups.filter((g: any) => {
        const isOwner = g.ownerId === safeUserId;
        const hasPermissions = g.myMember?.permissions && Array.isArray(g.myMember.permissions) && g.myMember.permissions.length > 0;
        return isOwner || hasPermissions;
      });

      // map the groups to ensure 'id' is the Group ID (grp_), not the Member ID (gmem_)
      const mappedGroups = moderatableGroups.map((g: any) => {
        // VRChat API getUserGroups returns membership objects.
        // g.id is the Membership ID (gmem_...)
        // g.groupId is the actual Group ID (grp_...)
        // We want the frontend to see 'id' as the Group ID.
        if (g.groupId && typeof g.groupId === 'string' && g.groupId.startsWith('grp_')) {
            return {
                ...g,
                id: g.groupId,      // helper for frontend
                _memberId: g.id     // preserve original membership ID
            };
        }
        return g;
      });

      log.info(`Fetched ${groups.length} total groups. Filtered to ${mappedGroups.length} moderatable groups.`);
      
      // Update InstanceLoggerService with allowed groups
      try {
          const { instanceLoggerService } = require('./InstanceLoggerService');
          instanceLoggerService.setAllowedGroups(mappedGroups.map(g => g.id));
      } catch (e) {
          log.error('Failed to update instance logger allowed groups', e);
      }

      return { success: true, groups: mappedGroups };

    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number }; stack?: string; config?: unknown };
      log.error('Failed to fetch groups:', { message: err.message, stack: err.stack });
      if (err.response?.status === 401) return { success: false, error: 'Session expired. Please log in again.' };
      return { success: false, error: err.message || 'Failed to fetch groups' };
    }
  });

  // Get specific group details
  ipcMain.handle('groups:get-details', async (_event, { groupId }: { groupId: string }) => {
    try {
      const client = getVRChatClient();
      if (!client) throw new Error("Not authenticated");
  
      // Revert to Object Syntax
      const response = await client.getGroup({ path: { groupId } });
      
      if (response.error) throw response.error;
      return { success: true, group: response.data };
      
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error('Failed to fetch group details:', error);
      return { success: false, error: err.message || 'Failed to fetch group' };
    }
  });

  // Get world details
  ipcMain.handle('worlds:get-details', async (_event, { worldId }: { worldId: string }) => {
    try {
      const client = getVRChatClient();
      if (!client) throw new Error("Not authenticated");
  
      // Revert to Object Syntax
      const response = await client.getWorld({ path: { worldId } });
      
      if (response.error) throw response.error;
      return { success: true, world: response.data };
      
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error('Failed to fetch world details:', error);
      return { success: false, error: err.message || 'Failed to fetch world' };
    }
  });

  // Get group members
  ipcMain.handle('groups:get-members', async (_event, { groupId, n = 100, offset = 0 }: { groupId: string; n?: number; offset?: number }) => {
    try {
      const client = getVRChatClient();
      if (!client) throw new Error("Not authenticated");
  
      // Revert to Object Syntax
      const response = await client.getGroupMembers({ 
        path: { groupId },
        query: { n, offset }
      });
      
      if (response.error) throw response.error;
      return { success: true, members: response.data ?? [] };
      
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error('Failed to fetch group members:', error);
      return { success: false, error: err.message || 'Failed to fetch members' };
    }
  });

  // Helper to extract array from VRChat API response
  // Some endpoints return Array, others return { results: Array } or { instances: Array }
  const extractArray = (data: unknown): unknown[] => {
      if (Array.isArray(data)) return data;
      const obj = data as Record<string, unknown> | null;
      if (obj && Array.isArray(obj.results)) return obj.results;
      if (obj && Array.isArray(obj.instances)) return obj.instances;
      return [];
  };

  // Get group join requests
  ipcMain.handle('groups:get-requests', async (_event, { groupId }: { groupId: string }) => {
    try {
      const client = getVRChatClient();
      log.info(`Fetching requests for group ${groupId}`);
      if (!client) throw new Error("Not authenticated");
  
      // Revert to Object Syntax
      const response = await client.getGroupRequests({ 
          path: { groupId },
          query: { n: 100, offset: 0 }
      });
      
      const requests = extractArray(response.data);
      log.info(`Requests fetch detected ${requests.length} items for ${groupId}`);
      
      if (response.error) {
        log.error('API Error in getGroupRequests:', response.error);
        throw response.error;
      }
      return { success: true, requests };
      
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error('Failed to fetch join requests:', error);
      return { success: false, error: err.message || 'Failed to fetch requests' };
    }
  });

  // Get group bans
  ipcMain.handle('groups:get-bans', async (_event, { groupId }: { groupId: string }) => {
    try {
      const client = getVRChatClient();
      log.info(`Fetching bans for group ${groupId}`);
      if (!client) throw new Error("Not authenticated");
  
      // Revert to Object Syntax
      const response = await client.getGroupBans({ 
        path: { groupId },
        query: { n: 100, offset: 0 }
      });
      
      const bans = extractArray(response.data);
      log.info(`Bans fetch detected ${bans.length} items for ${groupId}`);

      if (response.error) {
         log.error('API Error in getGroupBans:', response.error);
         throw response.error;
      }
      return { success: true, bans };
      
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error('Failed to fetch bans:', error);
      return { success: false, error: err.message || 'Failed to fetch bans' };
    }
  });

  // Get group audit logs
  ipcMain.handle('groups:get-audit-logs', async (_event, { groupId }: { groupId: string }) => {
    try {
      const client = getVRChatClient();
      if (!client) throw new Error("Not authenticated");
      
      // Revert to Object Syntax
      const response = await client.getGroupAuditLogs({ 
          path: { groupId },
          query: { n: 100, offset: 0 }
      });
      
      if (response.error) throw response.error;
      const logs = extractArray(response.data);
      return { success: true, logs };
      
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error('Failed to fetch audit logs:', error);
      return { success: false, error: err.message || 'Failed to fetch audit logs' };
    }
  });

  // Get active group instances - using direct HTTP to bypass SDK quirks
  ipcMain.handle('groups:get-instances', async (_event, { groupId }: { groupId: string }) => {
    // Helper to safely stringify objects with BigInt values
    const safeStringify = (obj: unknown): string => {
      try {
        return JSON.stringify(obj, (_key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        );
      } catch {
        return String(obj);
      }
    };

    try {
      const client = getVRChatClient();
      if (!client) throw new Error("Not authenticated");
      
      const userId = getCurrentUserId();
      if (!userId) throw new Error("No user ID found");

      log.info(`[INSTANCES] Fetching for group: ${groupId}, user: ${userId}`);

      // Strategy 1: Try the SDK method getUserGroupInstancesForGroup
      let instances: unknown[] = [];
      
      try {
        const clientAny = client as Record<string, unknown>;
        if (typeof clientAny.getUserGroupInstancesForGroup === 'function') {
          log.info('[INSTANCES] Trying SDK method: getUserGroupInstancesForGroup');
          const response = await (clientAny.getUserGroupInstancesForGroup as CallableFunction)({ 
            path: { userId, groupId } 
          });
          const data = (response as { data?: unknown })?.data ?? response;
          log.info('[INSTANCES] SDK Response:', safeStringify(data));
          instances = extractArray(data);
        } else {
          log.warn('[INSTANCES] SDK method getUserGroupInstancesForGroup not available');
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        log.warn('[INSTANCES] SDK getUserGroupInstancesForGroup failed:', err.message);
      }

      // Strategy 2: Try getUserGroupInstances (all groups) and filter
      if (instances.length === 0) {
        try {
          const clientAny = client as Record<string, unknown>;
          if (typeof clientAny.getUserGroupInstances === 'function') {
            log.info('[INSTANCES] Trying SDK method: getUserGroupInstances (all groups)');
            const response = await (clientAny.getUserGroupInstances as CallableFunction)({ 
              path: { userId } 
            });
            const data = (response as { data?: unknown })?.data ?? response;
            const allInstances = extractArray(data);
            log.info(`[INSTANCES] getUserGroupInstances returned ${allInstances.length} total instances`);
            
            if (allInstances.length > 0) {
              log.info('[INSTANCES] First instance keys:', Object.keys(allInstances[0] as object));
              log.info('[INSTANCES] First instance data:', safeStringify(allInstances[0]));
              
              // Try multiple filter strategies
              instances = allInstances.filter((inst: unknown) => {
                const i = inst as Record<string, unknown>;
                const matchGroupId = i.groupId === groupId;
                const matchGroupObj = (i.group as Record<string, unknown>)?.id === groupId;
                const matchOwnerId = String(i.ownerId || '').includes(groupId);
                return matchGroupId || matchGroupObj || matchOwnerId;
              });
              log.info(`[INSTANCES] After filtering: ${instances.length} instances for this group`);
            }
          }
        } catch (e: unknown) {
          const err = e as { message?: string };
          log.warn('[INSTANCES] SDK getUserGroupInstances failed:', err.message);
        }
      }

      // Strategy 3: Use client.get if available  
      if (instances.length === 0) {
        try {
          const clientAny = client as Record<string, unknown>;
          if (typeof clientAny.get === 'function') {
            log.info('[INSTANCES] Trying client.get fallback');
            
            // Try specific group endpoint first
            const url = `users/${userId}/instances/groups/${groupId}`;
            log.info('[INSTANCES] Calling:', url);
            const response = await (clientAny.get as CallableFunction)(url);
            const data = (response as { data?: unknown })?.data ?? response;
            log.info('[INSTANCES] client.get response:', safeStringify(data));
            instances = extractArray(data);
          }
        } catch (e: unknown) {
          const err = e as { message?: string };
          log.warn('[INSTANCES] client.get failed:', err.message);
        }
      }

      // Strategy 4: Try the getGroupInstances method (different from user-specific)
      if (instances.length === 0) {
        try {
          const clientAny = client as Record<string, unknown>;
          if (typeof clientAny.getGroupInstances === 'function') {
            log.info('[INSTANCES] Trying SDK method: getGroupInstances');
            const response = await (clientAny.getGroupInstances as CallableFunction)({ 
              path: { groupId } 
            });
            const data = (response as { data?: unknown })?.data ?? response;
            log.info('[INSTANCES] getGroupInstances response:', safeStringify(data));
            instances = extractArray(data);
          }
        } catch (e: unknown) {
          const err = e as { message?: string };
          log.warn('[INSTANCES] SDK getGroupInstances failed:', err.message);
        }
      }

      log.info(`[INSTANCES] Final result: ${instances.length} instances for group ${groupId}`);
      
      if (instances.length > 0) {
        log.info('[INSTANCES] Sample instance:', safeStringify(instances[0]));
      }
      
      return { success: true, instances };
      
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string };
      log.error('[INSTANCES] Fatal error:', err.message);
      log.error('[INSTANCES] Stack:', err.stack);
      return { success: false, error: err.message || 'Failed to fetch instances' };
    }
  });
}
