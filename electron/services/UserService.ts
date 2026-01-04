import { ipcMain } from 'electron';
import log from 'electron-log';
import { getVRChatClient } from './AuthService';

// Simple in-memory cache
// Map<userId, { data: UserData, timestamp: number }>
const userCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function setupUserHandlers() {
  
  // Get User Profile
  ipcMain.handle('users:get', async (_event, { userId }: { userId: string }) => {
    try {
      if (!userId) throw new Error("User ID is required");

      const client = getVRChatClient();
      if (!client) throw new Error("Not authenticated");

      // Check cache
      const cached = userCache.get(userId);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        log.debug(`Serving user ${userId} from cache`);
        return { success: true, user: cached.data };
      }

      log.info(`Fetching user ${userId} from API`);
      // Use Object syntax as verified in GroupService fixes
      const response = await client.getUser({ path: { userId } });
      
      if (response.error) {
          log.error('getUser returned error:', response.error);
          throw response.error;
      }
      
      // Update cache
      if (response.data) {
          userCache.set(userId, { data: response.data, timestamp: Date.now() });
      }

      return { success: true, user: response.data };

    } catch (error: any) {
      log.error(`Failed to fetch user ${userId}:`, error);
      return { success: false, error: error.message || 'Failed to fetch user' };
    }
  });

  // Clear cache for a user (useful if we get an update via WS)
  ipcMain.handle('users:clear-cache', async (_event, { userId }: { userId: string }) => {
      if (userId) {
          userCache.delete(userId);
      } else {
          userCache.clear();
      }
      return { success: true };
  });
}
