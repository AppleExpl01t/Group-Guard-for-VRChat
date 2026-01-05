import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { getVRChatClient, getCurrentUserId } from './AuthService';
import { instanceLoggerService } from './InstanceLoggerService';
import { logWatcherService } from './LogWatcherService';


// ============================================
// TYPES
// ============================================

export interface LiveEntity {
    id: string; // userId (usr_...)
    displayName: string;
    rank: string; // 'Visitor' | 'New User' | 'User' | 'Known' | 'Trusted' | 'Veteran' | 'Legend'
    isGroupMember: boolean;
    status: 'active' | 'kicked' | 'joining';
    avatarUrl?: string;
    lastUpdated: number;
}

// ============================================
// CACHE
// ============================================

const entityCache = new Map<string, LiveEntity>();

// Rate limit helper
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Queue for background fetching to avoid 429s
const fetchQueue: string[] = [];
let isFetching = false;

async function processFetchQueue(groupId: string) {
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

            const cacheKey = `${groupId}:${userId}`;
            // Double check cache before hitting API
            if (entityCache.has(cacheKey) && entityCache.get(cacheKey)!.rank !== 'Unknown') {
                 continue; 
            }

            log.info(`[InstanceService] Fetching details for ${userId}...`);

            try {
                // 1. Get User Details (Rank, Avatar)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const userRes = await (client as any).getUser({ path: { userId } });
                const userData = userRes.data;

                // 2. Check Group Membership
                let isMember = false;
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (client as any).getGroupMember({ path: { groupId, userId } });
                    isMember = true;
                } catch {
                    // 404 = not a member
                    isMember = false;
                }

                // Update Cache
                const displayName = userData?.displayName || 'Unknown';
                
                // Determine Trust Rank via tags
                let rank = 'User';
                const tags = userData?.tags || [];
                if (tags.includes('system_trust_legend')) rank = 'Legend';
                else if (tags.includes('system_trust_veteran')) rank = 'Veteran';
                else if (tags.includes('system_trust_trusted')) rank = 'Trusted';
                else if (tags.includes('system_trust_known')) rank = 'Known';
                else if (tags.includes('system_trust_basic')) rank = 'User';
                else if (tags.includes('system_trust_visitor')) rank = 'Visitor';

                const entity: LiveEntity = {
                    id: userId,
                    displayName,
                    rank,
                    isGroupMember: isMember,
                    status: 'active',
                    // Prioritize persistent profile pictures (userIcon via VRC+) over current avatar thumbnail
                    avatarUrl: userData?.userIcon || userData?.profilePicOverride || userData?.currentAvatarThumbnailImageUrl || '',
                    lastUpdated: Date.now()
                };

                entityCache.set(cacheKey, entity);
                
                // Emit update to UI
                // We send the single entity update to let UI merge it
                const windows = BrowserWindow.getAllWindows();
                for (const win of windows) {
                    win.webContents.send('instance:entity-update', entity);
                }

            } catch (err) {
                log.warn(`[InstanceService] Failed to fetch data for ${userId}`, err);
            }

            // Respect rate limits!
            await sleep(2000); 
        }
    } catch (e) {
        log.error('[InstanceService] Queue processor fatal error', e);
    } finally {
        isFetching = false;
        // Check if more came in
        if (fetchQueue.length > 0) processFetchQueue(groupId);
    }
}


export function setupInstanceHandlers() {
    
    // SCAN SECTOR
    ipcMain.handle('instance:scan-sector', async (_event, { groupId }) => {
        try {
            // 1. Get Log Players - Use public API now
            // logWatcherService is imported above
            
            const players = logWatcherService.getPlayers();
            
            const results: LiveEntity[] = [];

            for (const p of players) {
                // If we don't have a userId from logs yet (older logs might disable it), we can't query API easily.
                // Assuming LogWatcher regex captures userId (usr_...)
                if (!p.userId) {
                    results.push({
                        id: 'unknown',
                        displayName: p.displayName,
                        rank: 'Unknown',
                        isGroupMember: false,
                        status: 'active',
                        lastUpdated: 0
                    });
                    continue;
                }

                const cacheKey = `${groupId}:${p.userId}`;
                if (entityCache.has(cacheKey)) {
                    results.push(entityCache.get(cacheKey)!);
                } else {
                    // Create partial entry
                    const placeholder: LiveEntity = {
                        id: p.userId,
                        displayName: p.displayName,
                        rank: 'Loading...',
                        isGroupMember: false,
                        status: 'active',
                        lastUpdated: 0
                    };
                    results.push(placeholder);
                    
                    // Queue fetch
                    if (!fetchQueue.includes(p.userId)) {
                        fetchQueue.push(p.userId);
                    }
                }
            }

            // Trigger background processor
            processFetchQueue(groupId);

            return results;

        } catch (error) {
            log.error('Failed to scan sector:', error);
            return [];
        }
    });

    // RECRUIT (Invite User to Group)
    ipcMain.handle('instance:recruit-user', async (_event, { groupId, userId }) => {
        const client = getVRChatClient();
        if (!client) throw new Error("Not authenticated");

        try {
           log.info(`[InstanceService] Inviting ${userId} to group ${groupId}...`);
           
           // Correct API method for 'Invite User to Group' is createGroupInvite (POST /groups/:groupId/invites)
           // Requires 'userId' in the body.
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const result = await (client as any).createGroupInvite({ 
               path: { groupId },
               body: { userId }
           });
           
           log.info(`[InstanceService] Recruitment result for ${userId}:`, result.data || result);
           return { success: true };
        } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            // Check for rate limit
            if (e.response && e.response.status === 429) {
                 log.warn(`[InstanceService] Rate limited (429) recruiting ${userId}`);
                 return { success: false, error: 'RATE_LIMIT' }; // Frontend can handle this specifically
            }

            // If user is already in group or invited, API throws.
            const msg = e.response?.data?.error?.message || e.message;
            log.warn(`[InstanceService] Failed to recruit ${userId}: ${msg}`);
            return { success: false, error: msg };
        }
    });
    // KICK (Ban form Group)
    ipcMain.handle('instance:kick-user', async (_event, { groupId, userId }) => {
        const client = getVRChatClient();
        if (!client) throw new Error("Not authenticated");

        try {
           log.info(`[InstanceService] Kicking (Banning) ${userId} from group ${groupId}`);
           // Ban user from group (effectively kicks them from group instance)
           // standard ban duration? VRChat requires duration? 
           // usually 'hours' etc. We'll default to 1 hour for a "Kick".
           // API signature: banGroupMember(groupId, userId, { banType: '...'}) 
           // Actually SDK might look like: client.banGroupMember({ path: { groupId, userId }, body: { ... } })
           
           // We'll use a short ban (1 hour) to simulate a "Kick"
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           await (client as any).banGroupMember({ 
               path: { groupId, userId }
           });
           
           // We should also "unban" them immediately if it's just a kick? 
           // But VRChat kicks are bans. Let's just leave it as a ban for now or user can unban.
           // Or maybe we can just remove them? 'kick' isn't really a thing.

           return { success: true };
        } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            log.error(`[InstanceService] Failed to kick ${userId}`, e);
            return { success: false, error: e.message };
        }
    });

    // RALLY: FETCH TARGETS
    ipcMain.handle('instance:get-rally-targets', async (_event, { groupId }) => {
        const client = getVRChatClient();
        if (!client) throw new Error("Not authenticated");
        
        try {
            // Get recent 50 members
            // We can't easily filter by "online" via standard API efficiently without checking each.
            // So we'll just fetch the most recent members (likely active).
            // Or maybe 'last_login' sort if available? 'joinedAt' is safest.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const memRes = await (client as any).getGroupMembers({ 
                path: { groupId },
                query: { n: 50, offset: 0, sort: 'joinedAt:desc' } 
            });
            
            const members = memRes.data || [];
            const currentUserId = getCurrentUserId();
            
            // Map to frontend friendly format
            // Map to frontend friendly format
            const targets = members
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((m: any) => ({
                    id: m.user?.id,
                    displayName: m.user?.displayName,
                    thumbnailUrl: m.user?.thumbnailUrl
                }))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((t: any) => {
                     // 1. Exclude self
                     if (!t.id || t.id === currentUserId) return false;

                     // 2. Exclude users already here (from LogWatcher)
                     // Note: logWatcher players might not have ID yet if they haven't spoken/joined recently enough,
                     // but usually they do if we are tracking them.
                     // We also check by DisplayName as a fallback if ID is missing (risky but better than spamming)
                     const players = logWatcherService.getPlayers();
                     const isHere = players.some(p => 
                        (p.userId && p.userId === t.id) || 
                        (p.displayName && p.displayName === t.displayName)
                     );
                     
                     return !isHere;
                });

            return { success: true, targets };
        } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
             log.error(`[InstanceService] Failed to fetch rally targets`, e);
             return { success: false, error: e.message };
        }
    });

    // RALLY: INVITE SINGLE USER TO CURRENT INSTANCE
    ipcMain.handle('instance:invite-to-current', async (_event, { userId }) => {
         const client = getVRChatClient();
         if (!client) throw new Error("Not authenticated");

         try {
             // Resolve current instance
             const worldId = instanceLoggerService.getCurrentWorldId();
             const instanceId = instanceLoggerService.getCurrentInstanceId();
             
             if (!worldId || !instanceId) {
                 return { success: false, error: "No active instance" };
             }
             
              const fullId = `${worldId}:${instanceId}`;

             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             await (client as any).inviteUser({ 
                 path: { userId },
                 body: { instanceId: fullId }
             });
             
             return { success: true };
         } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
             // Rate Limit Check
             if (e.response && e.response.status === 429) {
                 return { success: false, error: 'RATE_LIMIT' };
             }
             const msg = e.response?.data?.error?.message || e.message;
             return { success: false, error: msg };
         }
    });

    // RALLY FROM PREVIOUS SESSION: Get users from a session file and invite them
    ipcMain.handle('instance:rally-from-session', async (_event, { filename }) => {
         const client = getVRChatClient();
         if (!client) throw new Error("Not authenticated");

         try {
             // 1. Check current instance
             const currentWorldId = instanceLoggerService.getCurrentWorldId();
             const currentInstanceId = instanceLoggerService.getCurrentInstanceId();
             
             if (!currentWorldId || !currentInstanceId) {
                 return { success: false, error: "You must be in an instance to rally users" };
             }
             
             const currentLocation = `${currentWorldId}:${currentInstanceId}`;
             log.info(`[InstanceService] Rally from session ${filename} to ${currentLocation}`);
             
             // 2. Get session events
             const events = instanceLoggerService.getSessionEvents(filename);
             if (!events || events.length === 0) {
                 return { success: false, error: "No events found in session" };
             }
             
             // 3. Extract unique user IDs from PLAYER_JOIN events
             const userIds = new Set<string>();
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             events.forEach((e: any) => {
                 if ((e.type === 'PLAYER_JOIN' || e.type === 'JOIN') && e.actorUserId && e.actorUserId.startsWith('usr_')) {
                     userIds.add(e.actorUserId);
                 }
             });
             
             if (userIds.size === 0) {
                 return { success: false, error: "No users with valid IDs found in this session" };
             }
             
             // 4. Filter out users already in current instance
             const currentPlayers = logWatcherService.getPlayers();
             const currentUserIds = new Set(currentPlayers.map(p => p.userId).filter(Boolean));
             const currentUserId = getCurrentUserId();
             
             const targetsToInvite = Array.from(userIds).filter(uid => 
                 uid !== currentUserId && !currentUserIds.has(uid)
             );
             
             if (targetsToInvite.length === 0) {
                 return { success: false, error: "All users from that session are already here or unavailable" };
             }
             
             log.info(`[InstanceService] Inviting ${targetsToInvite.length} users from previous session`);
             
             // Helper to emit progress to all windows
             const emitProgress = (data: { sent: number; failed: number; total: number; current?: string; done?: boolean }) => {
                 BrowserWindow.getAllWindows().forEach(win => {
                     if (!win.isDestroyed()) {
                         win.webContents.send('rally:progress', data);
                     }
                 });
             };
             
             // 5. Send invites with rate limit awareness
             let successCount = 0;
             let failCount = 0;
             const errors: string[] = [];
             const total = targetsToInvite.length;
             
             // Emit initial state
             emitProgress({ sent: 0, failed: 0, total, done: false });
             
             for (const userId of targetsToInvite) {
                 try {
                     log.info(`[InstanceService] Sending invite to ${userId}...`);
                     
                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
                     await (client as any).inviteUser({ 
                         path: { userId },
                         body: { instanceId: currentLocation }
                     });
                     successCount++;
                     log.info(`[InstanceService] ✓ Invite sent to ${userId} (${successCount}/${total})`);
                     
                     // Emit progress
                     emitProgress({ sent: successCount, failed: failCount, total, current: userId });
                     
                     // Small delay between invites to avoid rate limiting
                     await sleep(350);
                 } catch (inviteErr: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                     failCount++;
                     const errMsg = inviteErr.response?.data?.error?.message || inviteErr.message;
                     log.warn(`[InstanceService] ✗ Failed to invite ${userId}: ${errMsg}`);
                     
                     // Emit progress
                     emitProgress({ sent: successCount, failed: failCount, total });
                     
                     if (inviteErr.response?.status === 429) {
                         errors.push(`Rate limited after ${successCount} invites`);
                         break; // Stop on rate limit
                     }
                     // Continue on other errors
                 }
             }
             
             // Emit completion
             emitProgress({ sent: successCount, failed: failCount, total, done: true });
             
             return { 
                 success: true, 
                 invited: successCount, 
                 failed: failCount,
                 total: targetsToInvite.length,
                 errors: errors.length > 0 ? errors : undefined
             };
             
         } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
             log.error(`[InstanceService] Rally from session failed`, e);
             return { success: false, error: e.message };
         }
    });
    
    // CLOSE INSTANCE - Using SDK closeInstance method
    ipcMain.handle('instance:close-instance', async () => {
         const client = getVRChatClient();
         if (!client) throw new Error("Not authenticated");

         try {
             // Resolve current instance
             const worldId = instanceLoggerService.getCurrentWorldId();
             const instanceId = instanceLoggerService.getCurrentInstanceId();
             
             if (!worldId || !instanceId) {
                 return { success: false, error: "No active instance to close" };
             }

             log.warn(`[InstanceService] Closing instance - worldId: ${worldId}, instanceId: ${instanceId}`);
             
             // Use SDK closeInstance method with correct structure
             // SDK type: CloseInstance = { path: { worldId, instanceId }, query?: { hardClose?, closedAt? } }
             // URL template: '/instances/{worldId}:{instanceId}'
             
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const response = await (client as any).closeInstance({ 
                 path: { worldId, instanceId },
                 query: { hardClose: true }
             });
             
             // Safe stringify helper for BigInt
             const safeStringify = (obj: unknown) => JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
             
             log.info(`[InstanceService] closeInstance raw response:`, safeStringify(response));
             
             // Check for SDK error pattern
             if (response?.error) {
                 const errorMsg = response.error?.message || safeStringify(response.error);
                 log.error(`[InstanceService] API returned error:`, errorMsg);
                 return { success: false, error: errorMsg };
             }
             
             // Success - response.data should contain the instance info
             log.info(`[InstanceService] Instance closed successfully. Data:`, safeStringify(response?.data));
             return { success: true };
             
         } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
             log.error(`[InstanceService] Exception closing instance:`, e);
             log.error(`[InstanceService] Error details:`, {
                 message: e.message,
                 name: e.name,
                 stack: e.stack?.split('\n').slice(0, 5).join('\n')
             });
             const msg = e.response?.data?.error?.message || e.message || 'Unknown error';
             return { success: false, error: msg };
         }
    });

    // GET INSTANCE INFO (World Name, Image)
    ipcMain.handle('instance:get-instance-info', async () => {
         const worldId = instanceLoggerService.getCurrentWorldId();
         const instanceId = instanceLoggerService.getCurrentInstanceId();
         const worldName = instanceLoggerService.getCurrentWorldName();

         if (!worldId) return { success: false };

         // Try to get image from API
         let imageUrl = null;
         let apiName = null;
         
          const client = getVRChatClient();
          if (client) {
              try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const wRes = await (client as any).getWorld({ path: { worldId } });
                  imageUrl = wRes.data?.thumbnailImageUrl || wRes.data?.imageUrl;
                  apiName = wRes.data?.name;
              } catch {
                  // ignore API fail, fallback to log name
              }
          }

         return { 
             success: true, 
             worldId, 
             instanceId, 
             name: apiName || worldName || 'Unknown World', 
             imageUrl 
         };
    });
}
