import { ipcMain } from 'electron';
import log from 'electron-log';
const logger = log.scope('UserService');
import { getVRChatClient } from './AuthService';
import { networkService } from './NetworkService';

// Simple in-memory cache
// Map<userId, { data: UserData, timestamp: number }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Reusable fetch function for internal use
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchUser(userId: string): Promise<any> {
    if (!userId) throw new Error("User ID is required");

    // Check cache
    const cached = userCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      logger.debug(`Serving user ${userId} from cache`);
      return cached.data;
    }

    return networkService.execute(async () => {
        const client = getVRChatClient();
        if (!client) throw new Error("Not authenticated");

        log.info(`Fetching user ${userId} from API`);
        const response = await client.getUser({ path: { userId } });
        return response.data;
    }, `fetchUser:${userId}`).then(result => {
        if (result.success && result.data) {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const u = result.data as any;
             if (u.ageVerificationStatus !== undefined || u.ageVerified !== undefined) {
                  log.info(`[UserService] User ${u.displayName} fetched. AgeStatus: ${u.ageVerificationStatus}, AgeVerified: ${u.ageVerified}`);
             } else {
                  log.warn(`[UserService] User ${u.displayName} fetched but MISSING Age Verification fields.`);
             }

             userCache.set(userId, { data: result.data, timestamp: Date.now() });
             return result.data;
        } else {
            throw new Error(result.error);
        }
    });
}

export function setupUserHandlers() {
  
  // Get User Profile
  ipcMain.handle('users:get', async (_event, { userId }: { userId: string }) => {
      // fetchUser now returns a Promise that rejects on error, enabling try/catch in caller if needed, 
      // but here we already have a robust structure.
      // However, fetchUser handles the network call. 
      // Because fetchUser calls networkService internally, we can just await it.
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
      if (userId) {
          userCache.delete(userId);
      } else {
          userCache.clear();
      }
      return { success: true };
  });
}
