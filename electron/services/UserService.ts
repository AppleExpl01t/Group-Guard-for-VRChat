/**
 * User Service
 * 
 * Handles user-related IPC handlers.
 * Delegates API calls to VRChatApiService for centralized caching and error handling.
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { vrchatApiService } from './VRChatApiService';

const logger = log.scope('UserService');

/**
 * Reusable fetch function for internal use by other services
 * Delegates to VRChatApiService.getUser() which handles caching
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchUser(userId: string): Promise<any> {
    if (!userId) throw new Error("User ID is required");

    const result = await vrchatApiService.getUser(userId);

    if (result.success && result.data) {
        const u = result.data;
        if (u.ageVerificationStatus !== undefined || u.ageVerified !== undefined) {
            logger.info(`User ${u.displayName} fetched. AgeStatus: ${u.ageVerificationStatus}, AgeVerified: ${u.ageVerified}`);
        } else {
            logger.warn(`User ${u.displayName} fetched but MISSING Age Verification fields.`);
        }
        return result.data;
    } else {
        throw new Error(result.error || 'Failed to fetch user');
    }
}

export function setupUserHandlers() {

    // Get User Profile
    ipcMain.handle('users:get', async (_event, { userId }: { userId: string }) => {
        try {
            const user = await fetchUser(userId);
            return { success: true, user };
        } catch (e: unknown) {
            const err = e as { message?: string };
            return { success: false, error: err.message };
        }
    });

    // Clear cache for a user (useful if we get an update via WS)
    ipcMain.handle('users:clear-cache', async (_event, { userId }: { userId: string }) => {
        vrchatApiService.clearUserCache(userId);
        return { success: true };
    });

    // Get Avatar Details
    ipcMain.handle('avatars:get', async (_event, { avatarId }: { avatarId: string }) => {
        const result = await vrchatApiService.getAvatar(avatarId);
        return result; // result is ApiResult<VRCAvatar>
    });
}
