/**
 * BulkFriendService
 * 
 * Handles bulk friend operations from VRCX JSON exports.
 * Provides IPC handlers for selecting JSON files and sending friend requests.
 */

import { ipcMain, dialog } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import { getVRChatClient, getCurrentUserId } from './AuthService';
import { windowService } from './WindowService';
import { networkService } from './NetworkService';

const logger = log.scope('BulkFriendService');

// Rate limit helper
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================
// TYPES
// ============================================

interface VRCXFriendsJson {
    friends: string[];
}

interface VRChatApiError {
    message?: string;
    response?: {
        status?: number;
        data?: {
            error?: {
                message?: string;
            };
        };
    };
}

// ============================================
// IPC HANDLERS
// ============================================

export function setupBulkFriendHandlers() {
    logger.info('Setting up Bulk Friend handlers...');

    // SELECT JSON FILE
    ipcMain.handle('debug:select-friend-json', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'JSON Files', extensions: ['json'] }
            ],
            title: 'Select VRCX Friends Export'
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'No file selected' };
        }

        const filePath = result.filePaths[0];
        
        // Validate the file content
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content) as VRCXFriendsJson;
            
            if (!parsed.friends || !Array.isArray(parsed.friends)) {
                return { success: false, error: 'Invalid JSON format: missing "friends" array' };
            }

            // Count valid user IDs
            const validIds = parsed.friends.filter(id => id.startsWith('usr_'));
            
            return { 
                success: true, 
                path: filePath,
                count: validIds.length,
                preview: validIds.slice(0, 5)
            };
        } catch (e) {
            logger.error('Failed to read/parse JSON file:', e);
            return { success: false, error: 'Failed to parse JSON file' };
        }
    });

    // BULK FRIEND FROM JSON
    ipcMain.handle('debug:bulk-friend-from-json', async (_event, { jsonPath, delayMs }: { jsonPath: string; delayMs?: number }) => {
        const client = getVRChatClient();
        if (!client) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            // 1. Read and parse JSON
            const content = fs.readFileSync(jsonPath, 'utf-8');
            const parsed = JSON.parse(content) as VRCXFriendsJson;

            if (!parsed.friends || !Array.isArray(parsed.friends)) {
                return { success: false, error: 'Invalid JSON format' };
            }

            // 2. Filter valid user IDs
            const userIds = parsed.friends.filter(id => id.startsWith('usr_'));
            const currentUserId = getCurrentUserId();
            
            // Remove self from list
            const targets = userIds.filter(id => id !== currentUserId);

            if (targets.length === 0) {
                return { success: false, error: 'No valid user IDs found in JSON' };
            }

            logger.info(`[BulkFriend] Starting bulk friend requests for ${targets.length} users`);

            // 3. Get current friends to skip already-friended users
            let existingFriendIds = new Set<string>();
            try {
                // Fetch current friends list
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const friendsRes = await (client as any).getFriends({ query: { n: 100, offset: 0 } });
                const friends = Array.isArray(friendsRes) ? friendsRes : (friendsRes?.data || []);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                existingFriendIds = new Set(friends.map((f: any) => f.id));
                logger.info(`[BulkFriend] Fetched ${existingFriendIds.size} existing friends`);
            } catch (e) {
                logger.warn('[BulkFriend] Could not fetch existing friends, proceeding anyway:', e);
            }

            // 4. Filter out existing friends
            const finalTargets = targets.filter(id => !existingFriendIds.has(id));
            const skippedCount = targets.length - finalTargets.length;

            if (finalTargets.length === 0) {
                return { success: false, error: 'All users in the list are already friends' };
            }

            logger.info(`[BulkFriend] ${finalTargets.length} targets after filtering (${skippedCount} already friends)`);

            // 5. Send friend requests with rate limiting
            const emitProgress = (data: { sent: number; skipped: number; failed: number; total: number; current?: string; done?: boolean }) => {
                windowService.broadcast('bulk-friend:progress', data);
            };

            let successCount = 0;
            let failCount = 0;
            const errors: string[] = [];
            const total = finalTargets.length;
            const delay = delayMs || 1500; // Default 1.5s between requests

            // Emit initial state
            emitProgress({ sent: 0, skipped: skippedCount, failed: 0, total, done: false });

            for (const userId of finalTargets) {
                try {
                    logger.info(`[BulkFriend] Sending friend request to ${userId}...`);

                    // Send friend request using VRChat API
                    await networkService.execute(async () => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (client as any).friend({
                            path: { userId }
                        });
                    }, `friend-request:${userId}`);

                    successCount++;
                    logger.info(`[BulkFriend] ✓ Friend request sent to ${userId} (${successCount}/${total})`);

                    // Emit progress
                    emitProgress({ sent: successCount, skipped: skippedCount, failed: failCount, total, current: userId });

                    // Rate limit delay
                    await sleep(delay);

                } catch (e: unknown) {
                    const err = e as VRChatApiError;
                    failCount++;
                    const errMsg = err.response?.data?.error?.message || err.message || 'Unknown error';
                    logger.warn(`[BulkFriend] ✗ Failed to send friend request to ${userId}: ${errMsg}`);

                    // Emit progress
                    emitProgress({ sent: successCount, skipped: skippedCount, failed: failCount, total });

                    // Stop on rate limit
                    if (err.response?.status === 429) {
                        errors.push(`Rate limited after ${successCount} requests`);
                        logger.error('[BulkFriend] Rate limited! Stopping.');
                        break;
                    }

                    // Continue on other errors (user may have rejected requests, privacy settings, etc.)
                }
            }

            // Emit completion
            emitProgress({ sent: successCount, skipped: skippedCount, failed: failCount, total, done: true });

            logger.info(`[BulkFriend] Completed: ${successCount} sent, ${failCount} failed, ${skippedCount} skipped`);

            return {
                success: true,
                sent: successCount,
                failed: failCount,
                skipped: skippedCount,
                total: finalTargets.length,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (e: unknown) {
            const err = e as Error;
            logger.error('[BulkFriend] Bulk friend operation failed:', e);
            return { success: false, error: err.message || 'Unknown error' };
        }
    });

    logger.info('Bulk Friend handlers registered.');
}
